# SSE proxy patterns: streaming OpenAI-compatible completions through Node and Python reverse proxies without buffering

- **Date (UTC):** 2026-09-16
- **Job:** `31c8c9a1-abaf-4f22-9851-74c900499f5b` (account 10)
- **Phases:** ResearchNotice, ResearchPlanning, WebResearch, answer, PdfMdGen
- **Source:** oxmoiz/qwen-mesh-agent deep research via GHA compute harness

---

# Beyond the Buffer: Achieving Low-Latency LLM Streaming with Unbuffered Reverse Proxies in Python and Node.js

## The Pervasive Challenge of Proxy Buffering in Real-Time Streaming

The successful implementation of low-latency streaming for Large Language Model (LLM) completions, particularly using the OpenAI API format, hinges on the reliable delivery of Server-Sent Events (SSE) [[59,98]]. SSE has become the de facto standard for this use case because it allows a server to push data to a client over a single, long-lived HTTP connection without the overhead of protocols like WebSockets, which require bidirectional communication [[18,24]]. However, while SSE is inherently simple, its deployment behind a standard web infrastructure introduces a profound and pervasive technical challenge: the buffering behavior of intermediate reverse proxies and CDNs [[12,27]]. This buffering mechanism, designed to optimize performance by aggregating data before transmission, fundamentally conflicts with the incremental, chunk-by-chunk nature of an SSE stream, often rendering real-time interaction impossible [[15,60]]. Understanding this conflict is paramount to designing any viable proxy architecture.

Reverse proxies such as Nginx, Cloudflare, Vercel Edge, and Traefik operate as intermediaries between clients and origin servers [[12,49,154]]. Their primary function is to improve performance and security by caching content, load balancing requests, and shielding the backend server from direct exposure [[184]]. A core optimization technique employed by these systems is response buffering [[16]]. When a proxy receives a response from an upstream server, instead of immediately forwarding each small data packet to the client, it collects the data in an internal buffer [[14]]. The proxy then sends the accumulated data to the client either when the buffer reaches a predefined size threshold or when the upstream server closes its connection [[15]]. For static content or short-lived API responses, this behavior is highly beneficial, reducing network congestion and improving perceived latency. However, for SSE, where the upstream server generates a continuous flow of small chunks of text (tokens) over potentially minutes-long connections, this default behavior is catastrophic [[56]]. The client will experience significant delays, waiting for the proxy's buffer to fill up before receiving any data, or until the entire stream is generated and the connection is closed, at which point all buffered chunks are released at once [[60]]. Developers have reported first-token latencies of over 30 seconds in such scenarios, completely undermining the purpose of streaming [[60]].

This issue is not confined to a single technology but is a universal characteristic of modern proxy and CDN systems. For Nginx, the problem is explicitly documented; by default, it buffers responses from the proxied server, which breaks the streaming flow because it holds onto event chunks until the buffer is full [[16,28]]. Similarly, Cloudflare is known to buffer SSE responses, collecting data until a certain threshold is met before sending it to the client [[14,168]]. Users deploying applications on platforms like Vercel have encountered identical problems, where edge functions work locally but fail to stream when deployed, due to buffering within Vercel's edge network [[49,169]]. Even enterprise-grade systems like Apache APISIX require explicit configuration via a plugin to disable buffering for routes intended for streaming [[66]]. This ubiquity underscores that response buffering is a deliberate, default performance optimization that must be explicitly disabled for any real-time streaming protocol like SSE to function correctly [[79]]. The symptoms are consistent across platforms: a complete lack of streaming, where the client sees no output until the final response is ready, effectively turning a streaming endpoint into a non-streaming one [[94]]. Diagnosis typically involves temporarily bypassing the proxy layer, for instance, by disabling Cloudflare's proxy mode, to verify that the delay originates from the intermediary and not the origin server itself [[51]].

Beyond buffering, another related issue is premature connection termination. Long-lived streaming connections are vulnerable to being dropped by proxies configured with default timeout values. Many reverse proxies are set to close idle connections after a period of inactivity, typically around 60 seconds [[42,204]]. Since an LLM stream might involve pauses between token generation, this default timeout can cause the proxy to terminate the connection, leading to a broken stream and requiring the client to reconnect [[42]]. This further degrades the user experience and adds operational complexity. Therefore, successfully proxying an SSE stream requires addressing not only the immediate problem of data aggregation but also the underlying network policies governing connection longevity. The solution lies in a meticulous, multi-layered approach involving explicit configuration at the proxy level, careful management of HTTP headers, and robust application logic designed to handle the nuances of streaming I/O. Without this diligence, even a perfectly implemented SSE endpoint will fail to deliver its promise of low-latency, interactive AI experiences [[23]].

## Architectural Patterns for Unbuffered SSE Proxies

To overcome the challenges posed by proxy buffering and enable low-latency streaming of OpenAI-compatible completions, developers have adopted two primary architectural patterns: the direct streaming proxy (a simple pass-through model) and the enhanced gateway (a feature-rich intermediary). The choice between these architectures depends on the project's requirements for simplicity, control, cost optimization, and added functionality. Both patterns rely on the same foundational principle—unbuffered stream pipelining—but differ significantly in their scope and complexity.

The first and most straightforward pattern is the **Direct Streaming Proxy**, also known as a simple pass-through or lightweight reverse proxy. In this architecture, the primary and often sole responsibility of the proxy is to act as a conduit, forwarding the raw SSE stream from an upstream LLM provider (like OpenAI) directly to the downstream client with minimal or no modification [[10]]. This pattern is ideal for use cases where the goal is simply to add a layer of indirection—for example, to manage API keys, apply basic request filtering, or add a Content Security Policy. The implementation is relatively simple, often involving an endpoint in a web framework that makes a request to the upstream service and then pipes the incoming response stream directly to the client's response object. While this approach offers maximum transparency and minimal latency from the application layer, it provides little value beyond routing. Its main advantage is its lightweight nature; for instance, a standalone FastAPI reverse proxy built for PII redaction was noted to consume as little as 24MB of RAM, demonstrating its efficiency [[10]]. This simplicity makes it a popular choice for quick integrations or when the developer wants to avoid the overhead of managing a more complex system.

The second, more sophisticated pattern is the **Enhanced Gateway**, which transforms the proxy from a mere conduit into a powerful intermediary or "smart" router. This architecture goes far beyond simple forwarding by introducing a rich set of features designed to manage, optimize, and secure interactions with LLM providers [[87,119]]. An enhanced gateway can serve as a central hub that connects to multiple backend LLM services, intelligently routing requests based on various criteria such as cost, performance, availability, or model specialization [[87]]. For example, a gateway could be configured to use a cheaper local model for simple queries and switch to a premium provider like OpenAI for more complex tasks, thereby optimizing operational costs—a feature highlighted by projects like `lm-proxy` which claims to save users 40-70% on API costs [[119,191]]. Beyond routing, these gateways provide extensive capabilities for request and response transformation, allowing developers to modify payloads, log detailed usage metrics, enforce rate limits, manage virtual API keys, and integrate observability tools [[117,119]]. Projects like LiteLLM exemplify this pattern, offering a high-performance, production-ready solution with benchmarked P95 latency of just 8ms at 1,000 requests per second (RPS) [[25]]. Other examples include `KeepRoLLMing`, an OpenAI-compatible proxy designed to make local and remote LLMs more reliable, and `star-cliproxy`, which exposes local AI CLIs as an OpenAI-compatible endpoint [[118,194]]. While this architecture is significantly more complex to build and maintain, it offers unparalleled flexibility, control, and value, making it suitable for production environments with demanding requirements for reliability, cost management, and feature richness.

Regardless of the chosen architecture, the core technical requirement remains the same: unbuffered stream pipelining. Whether it's a simple pass-through or a complex gateway, the application must read data from the upstream response stream and write it to the downstream client stream in small chunks without holding the entire response in memory or waiting for a flush command. This is achieved differently in Python and Node.js. In Python, using a framework like FastAPI, this is typically accomplished with generators and the `StreamingResponse` class, which yields data from the upstream call directly to the client [[5,53]]. In Node.js, the native `stream` module is leveraged to pipe the response from the upstream HTTP request directly to the client's response object, a process that is both memory-efficient and well-suited for handling back-pressure [[96,202]]. The following table summarizes the key characteristics of these two architectural patterns.

| Feature | Direct Streaming Proxy (Pass-Through) | Enhanced Gateway (Feature-Rich) |
| :--- | :--- | :--- |
| **Primary Function** | Simple pass-through of the upstream stream to the client [[10]]. | Intelligent routing, transformation, and management of requests to multiple LLM providers [[87]]. |
| **Complexity** | Low. Minimal application logic required. | High. Requires sophisticated routing, caching, and management logic [[119]]. |
| **Cost Optimization** | None, unless combined with other tools. | Core feature. Can route to cheaper models or cache results to reduce costs [[119,191]]. |
| **Security & Control** | Basic, e.g., API key management. | Advanced, e.g., virtual API key management, rate limiting, request/response transformation [[117,119]]. |
| **Observability** | Limited to basic logging. | Comprehensive, including detailed usage metrics, error tracking, and integration with monitoring tools [[87]]. |
| **Use Case Example** | Quickly adding a layer of indirection to an existing OpenAI endpoint. | Building a production-grade AI platform that uses multiple models from different vendors [[87,119]]. |
| **Representative Tools** | Custom-built FastAPI/Express.js apps [[10]]. | LiteLLM, LM-Proxy, KeepRoLLMing [[25,119,194]]. |

Ultimately, the decision between these two patterns is a strategic one. For prototyping, simple integrations, or when absolute minimal latency from the application layer is the highest priority, a direct streaming proxy is the most pragmatic choice. However, for any serious, production-oriented application that anticipates growth, varied model requirements, or a need for cost and security management, investing in an enhanced gateway architecture is not just beneficial but often essential for long-term success.

## Python-Based Proxy Implementation with FastAPI

In the Python ecosystem, FastAPI has emerged as a premier framework for building high-performance web services, including unbuffered SSE proxies for LLM streaming [[3,19]]. Its asynchronous capabilities, built-in support for streaming responses, and automatic OpenAPI documentation generation make it exceptionally well-suited for this task. The core of implementing an unbuffered SSE proxy in FastAPI revolves around its `StreamingResponse` class, which allows a path operation function to return a generator that yields data incrementally, enabling the server to push tokens to the client as they are received from the upstream provider [[8,189]].

The implementation pattern typically follows a clear sequence of steps. First, an endpoint is defined in the FastAPI application to accept requests, usually mirroring the OpenAI API structure, such as a POST request to `/v1/chat/completions`. Inside this endpoint, the application constructs a request to the actual upstream LLM provider (e.g., OpenAI's API). To achieve unbuffered streaming, the call to the upstream API must also be asynchronous and stream the response. This is commonly done using a library like `httpx`, which supports streaming requests. Once the connection to the upstream provider is established and returns a streaming response object, the FastAPI `StreamingResponse` is instantiated. The constructor takes a generator function as its primary argument. This generator's job is to iterate over the chunks from the upstream stream, yield them to FastAPI, and ensure the stream is properly formatted for SSE if necessary [[5,53]].

A practical example of this pattern involves creating a generator that iterates over the response from the upstream API and yields each chunk directly. The generator must also handle the end of the stream gracefully. For instance, the upstream provider might signal the end of the stream with a special message, such as `data: [DONE]` in OpenAI's format [[128,160]]. The generator would need to detect this terminator and yield it, or handle it appropriately to signal completion to the client. Starlette, the ASGI framework underlying FastAPI, provides robust mechanisms for handling disconnections. It automatically listens for an `http.disconnect` message, which is sent by the server when the client closes the connection [[129]]. If this message is received, Starlette cancels the generator, preventing it from continuing to process a stream for a client that is no longer listening. This is a crucial feature for resource management and preventing orphaned tasks [[129]]. Several open-source projects demonstrate this pattern, such as a FastAPI application designed specifically to return OpenAI's response as a stream of Server-Sent Events [[5]], and a repository showing how to stream LLM outputs directly to a browser using FastAPI and SSE [[17]]. One notable project is a lightweight FastAPI reverse proxy built for strict PII redaction in LLM applications, showcasing the framework's suitability for building efficient, specialized proxy services [[10]].

While FastAPI provides a powerful abstraction, developers must be mindful of potential pitfalls. One common issue arises from the interaction between streaming generators and Python's context managers (`with` statements) [[171]]. Because the generator may be paused between yields, a `finally` block within a `with` statement associated with the streaming logic might execute before the streaming process is fully complete, leading to premature cleanup of resources [[170]]. Another consideration is error handling within the generator. If an exception occurs while reading from the upstream stream or processing a chunk, it must be caught and handled gracefully. An unhandled exception could terminate the generator abruptly, leaving the client in an undefined state. Properly formatting the SSE payload is also critical; each chunk must be a JSON-encoded string prefixed with `data:` and terminated with a newline, a convention followed by providers like OpenAI [[157,160]]. The official OpenAI Python library itself uses a streaming module to handle these details, providing a reference for correct implementation [[137,167]].

For developers seeking to implement SSE-specific features, FastAPI's `EventSourceResponse` offers a higher-level alternative to `StreamingResponse` [[190]]. This class is tailored specifically for SSE and simplifies the process of setting appropriate headers and formatting events with fields like `event`, `id`, and `retry` [[190]]. By using `yield` in a path operation function and setting `response_class=EventSourceResponse`, developers can easily generate structured SSE messages [[190]]. However, for a simple proxy that aims to forward the stream with minimal modification, `StreamingResponse` paired with a raw generator is often sufficient and more direct [[187]]. The choice between these classes depends on whether the proxy needs to strictly adhere to the W3C SSE specification or simply needs to proxy a stream that already conforms to it. Ultimately, FastAPI provides a robust and flexible foundation for building unbuffered SSE proxies, abstracting away much of the complexity of ASGI while still giving developers fine-grained control over the streaming pipeline.

## Node.js-Based Proxy Implementation with Streams and Middleware

In the Node.js ecosystem, building an unbuffered SSE proxy leverages the platform's powerful and ubiquitous stream-based I/O model [[202]]. The core principle is to create a pipeline where data read from the upstream provider's response stream is written directly to the downstream client's response stream, minimizing memory usage and avoiding artificial delays [[96]]. This can be achieved using either the native `http` module for maximum control or higher-level middleware and libraries that abstract away some of the boilerplate. The choice of tooling significantly impacts the ease of implementation and the handling of edge cases like timeouts and errors.

One of the most direct and transparent methods is to use Node.js's native `http` module to construct a raw proxy [[142]]. This approach gives the developer complete control over every aspect of the request and response lifecycle. The process involves creating an HTTP request to the upstream LLM provider and then piping its response object (which is a readable stream) directly to the `res` object (which is a writable stream) in the incoming request handler. This `res.pipe(upstreamRes)` operation establishes the unbuffered stream pipeline. This method is celebrated for its efficiency and lack of hidden abstractions, making it easier to reason about performance and debugging [[142]]. However, it requires manual implementation of features like request header rewriting, authentication logic, and error handling, which higher-level tools provide out of the box [[32]].

For developers working within the Express.js framework, several middleware libraries are available to simplify proxy creation. The most prominent is `http-proxy-middleware`, a lightweight, one-liner solution for connecting middleware to a proxy [[30,54]]. Its typical usage involves calling `app.use(createProxyMiddleware(...))` to route requests matching a certain path to the target upstream server [[33]]. While convenient, developers have reported challenges with this middleware in streaming contexts. Common issues include the proxy disconnecting the SSE connection after a default timeout (often cited as 2 minutes) [[29]] or failing to send any response at all if the configuration is incorrect [[163]]. These problems highlight that generic middleware may not be optimized for the unique demands of long-lived, chunked streams. Successful implementation often requires careful stream piping within the middleware's `onProxyRes` or `onProxyReq` lifecycle hooks to transform or inspect the stream without breaking it [[31,182]]. For example, one might need to attach a data listener to the proxy response to debug why data isn't flowing through [[175]].

For more programmatic and robust control, lower-level libraries like `node-http-proxy` or its modern successor, `http-proxy-3`, are recommended [[48,76]]. These libraries provide a more granular API for programmatically creating proxying rules and handling events, making them suitable for building custom components and complex gateways [[48]]. They allow for fine-grained manipulation of the request and response streams, including handling WebSockets, which is a valuable feature if the proxy needs to support multiple types of real-time communication [[48]]. The ability to programmatically create proxying rules makes these libraries powerful for building the enhanced gateway architecture discussed previously.

Another important concept in Node.js streaming is back-pressure. When a downstream consumer (the client) cannot keep up with the rate of data produced by an upstream source (the LLM provider), Node.js streams automatically slow down the upstream producer to prevent overwhelming the system's memory. This is handled automatically by the `pipe()` function, which manages the flow of data between streams [[96]]. However, developers must be cautious when inserting custom transform streams into the pipeline. A poorly implemented transform stream that doesn't properly handle back-pressure can stall the entire pipeline [[97]]. Using `stream.PassThrough` is a common idiom for creating simple, stateless transform streams that merely pass data from the writable side to the readable side without modification, which is useful for logging or simple inspection without disrupting the flow [[97,203]]. When dealing with compressed streams, it's also crucial to ensure that decompression is handled correctly; removing compression middleware, for instance, can sometimes resolve unexpected streaming issues [[75]]. Debugging Node.js streaming proxies can be challenging, as problems often manifest as silent failures, such as the `data` event never firing on the proxy response object [[175]]. Careful logging and understanding the underlying stream mechanics are essential for troubleshooting.

## Critical Infrastructure and Protocol Configurations for Success

Achieving reliable, low-latency SSE streaming through a reverse proxy is not solely an application-level concern; it is critically dependent on correct configurations at the infrastructure and protocol levels. Most reverse proxies and CDNs are engineered for performance, and their default behaviors—such as response buffering and aggressive timeout enforcement—are fundamentally at odds with the continuous, long-lived nature of an SSE stream [[12,27]]. Therefore, diligent configuration of the network stack is a non-negotiable prerequisite for success. This involves a combination of server directives, specific HTTP headers, and adherence to the SSE protocol specification.

The single most important infrastructure configuration is the explicit disabling of response buffering. For the widely used Nginx web server, this is accomplished by adding the directive `proxy_buffering off;` within the relevant `location` block that handles the streaming endpoint [[28,67,72]]. This directive tells Nginx to bypass its internal buffer and stream the response from the upstream server to the client in real-time [[16]]. Some sources recommend complementing this with `proxy_cache off;` to ensure caching is also disabled for the streaming route, as caching mechanisms can also introduce delays [[72]]. However, for Nginx, there is a more definitive way to instruct it not to buffer a specific response: the `X-Accel-Buffering` header [[71]]. By setting `X-Accel-Buffering: no` in the response headers from the upstream application, the developer can guarantee that Nginx will not buffer that particular stream, regardless of the global `proxy_buffering` setting [[95,134]]. This header is considered the authoritative method for disabling buffering in Nginx, and its use is widely recommended in the community [[68,146]]. The importance of this step cannot be overstated; failure to disable buffering is the primary cause of delayed or broken streaming, with developers reporting first-token latencies of over 30 seconds as a direct result [[60]].

Complementing the disabling of buffering is the management of timeouts. A long-lived SSE connection can appear "idle" to a proxy if there is a brief pause between token emissions from the LLM. By default, many proxies, including Nginx, will close a connection that has been inactive for 60 seconds [[42,204]]. To prevent this premature termination, the `proxy_read_timeout` directive must be increased to a large value, such as `300s` (5 minutes) or even `1d` (1 day), to accommodate the entire duration of the streaming session [[127,204,205]]. This ensures the proxy maintains the connection open, allowing the stream to flow uninterrupted. Furthermore, since SSE relies on chunked transfer encoding, it is often advisable to disable gzip compression at the proxy level (`gzip off;`) to prevent interference with the chunking mechanism, which can otherwise lead to garbled responses [[126,181,205]].

At the protocol level, specific HTTP headers must be correctly set to communicate the intent of the stream to all intermediaries. The response from the proxy to the client must include the `Content-Type` header set to `text/event-stream` [[157,158]]. This signals to the client's `EventSource` API that it should expect an SSE stream. Additionally, the `Cache-Control: no-cache` header is essential to prevent any intermediate caches from storing and replaying the long-lived stream, which would destroy its real-time nature [[95]]. The combination of `proxy_buffering off;` (or the `X-Accel-Buffering: no` header) and `proxy_read_timeout` configuration forms the bedrock of a functional streaming proxy infrastructure. The following table outlines the key configurations for Nginx.

| Configuration Directive/Header | Purpose | Recommended Value/Setting |
| :--- | :--- | :--- |
| `proxy_buffering` | Disables Nginx's response buffering for the proxied location. | `off;` [[28,72]] |
| `proxy_cache` | Disables Nginx's caching for the proxied location. | `off;` [[72]] |
| `proxy_read_timeout` | Sets the timeout for reading a response from the upstream server. | `300s;` or larger value (e.g., `1d`) [[42,127]] |
| `gzip` | Disables Gzip compression at the Nginx level to avoid interfering with chunked encoding. | `off;` [[126,205]] |
| `X-Accel-Buffering` (Header) | A definitive instruction to Nginx to disable buffering for this specific response. | `no` [[71,95,134]] |
| `Cache-Control` (Header) | Prevents intermediate caches from storing the long-lived stream. | `no-cache` [[95]] |
| `Content-Type` (Header) | Specifies the response format as Server-Sent Events. | `text/event-stream` [[157,158]] |

These configurations are not optional tweaks but mandatory requirements for any production-grade SSE proxy. They represent the critical interface between the streaming-aware application and the traditionally batch-oriented world of web proxies. Failure to apply these settings correctly will invariably lead to the very problems developers seek to solve: high latency, broken streams, and a degraded user experience. The vigilance required to configure this stack correctly is a testament to the subtle yet profound impact that network infrastructure can have on real-time applications.

## Ecosystem, Performance, and Advanced Considerations

The landscape for building unbuffered SSE proxies is supported by a vibrant and growing open-source ecosystem, numerous pre-built tools, and a wealth of community knowledge. While constructing a proxy from scratch using frameworks like FastAPI or Node.js streams is feasible, leveraging existing solutions can significantly accelerate development and incorporate battle-tested patterns for reliability, security, and performance. The choice of tool often depends on the desired balance between customization and out-of-the-box functionality.

A variety of open-source projects provide drop-in replacements or comprehensive gateways that are compatible with the OpenAI API. On GitHub, searching for topics like `openai-compatible` or `openai-compatible-proxy-server` reveals numerous repositories [[86,117]]. Projects like `lm-proxy` and `KeepRoLLMing` are prime examples of enhanced gateways, offering self-hosted, OpenAI-compatible endpoints with features designed to improve reliability and reduce costs [[119,194]]. `star-cliproxy` provides a unique take by running local AI CLIs as subprocesses and exposing them through a unified OpenAI-compatible streaming endpoint [[118]]. These tools often come with built-in support for multiple providers, request/response logging, and security features, addressing many of the advanced considerations developers face. The existence of these projects demonstrates a strong community effort to solve the common problems associated with LLM integration, providing a solid foundation upon which to build more specialized applications.

Performance is a critical metric for any LLM streaming proxy, directly impacting the user experience. Key performance indicators include Time to First Token (TTFT), which measures responsiveness, and inter-token latency, which determines the smoothness of the typing effect [[99,147]]. While the provided materials lack comprehensive comparative benchmarks between different proxy implementations, some data exists for specific tools. For instance, LiteLLM, a popular Python library for building gateways, reports a P95 latency of 8ms under a load of 1,000 RPS, indicating high throughput and low latency suitable for production environments [[25]]. Optimizing these metrics involves not only efficient proxy code but also tuning the underlying serving infrastructure. Techniques like continuous batching and speculative decoding are being explored at the inference server level (e.g., with vLLM) to reduce TTFT and increase throughput, and a well-configured proxy should not become a bottleneck in this chain [[103,132]]. The choice of reverse proxy software itself can also have an impact; for example, Fastify is noted for its high performance, making it a strong candidate for building fast, proxy-aware SSE applications [[122,123]].

Beyond the core streaming functionality, advanced proxy implementations must address several other considerations. Error handling is paramount. The SSE specification requires that the stream ends with a `data: [DONE]` message [[128]]. If this terminator is missing or malformed, clients can crash or throw errors during stream finalization [[152,162]]. A robust proxy must ensure that the upstream response is parsed and reformatted correctly, including proper handling of empty data events, which can cause crashes if not checked for [[207]]. Another advanced topic is handling client reconnections. For long-running sessions, a client might lose connectivity and attempt to reconnect. A resilient system can support this by assigning a `stream_id` to each session and having the client send its last received sequence number upon reconnecting, allowing the server to resume the stream from where it left off, for example, by reading from a cached sequence in Redis [[159]]. Finally, security is a major concern. An OpenAI-compatible proxy acts as a central access point to expensive LLM services and may handle sensitive data. Therefore, implementing robust security measures, such as those offered by dedicated gateway solutions like `lm-proxy` (e.g., secure Virtual API key management), is essential [[119]]. In summary, while the initial hurdle of unbuffered streaming is significant, the mature ecosystem and focus on performance and reliability mean that developers have access to powerful tools and established patterns to build sophisticated and production-ready LLM proxy solutions.

---

## References

- [Server-Sent Events (SSE)](https://fastapi.tiangolo.com/tutorial/server-sent-events/)
- [Building an OpenAI-Compatible Streaming Interface Using ...](https://medium.com/@moustafa.abdelbaky/building-an-openai-compatible-streaming-interface-using-server-sent-events-with-fastapi-and-8f014420bca7)
- [Real-time OpenAI response streaming with FastAPI](https://sevalla.com/blog/real-time-openai-streaming-fastapi/)
- [Streaming in React the Simple Way: Server-Sent Events (with ...](https://www.youtube.com/watch?v=hOAAg1WaZh8)
- [talesmousinho/fastapi-openai-sse-stream](https://github.com/talesmousinho/fastapi-openai-sse-stream)
- [Building a Server-Sent Events (SSE) MCP Server with ...](https://www.ragie.ai/blog/building-a-server-sent-events-sse-mcp-server-with-fastapi)
- [How to send server-side events from python (fastapi) upon ...](https://stackoverflow.com/questions/58895486/how-to-send-server-side-events-from-python-fastapi-upon-calls-to-a-function-th)
- [Build a FastAPI SSE streaming response endpoint](https://genbodha.ai/disciplines/genai-application-engineer/preview/fsga-c01-l1)
- [Realtime Log Streaming with FastAPI and Server-Sent ...](https://amittallapragada.github.io/docker/fastapi/python/2020/12/23/server-side-events.html)
- [Built a lightweight FastAPI reverse proxy (24MB RAM) to ...](https://www.reddit.com/r/FastAPI/comments/1vhmryg/built_a_lightweight_fastapi_reverse_proxy_24mb/)
- [fastify/sse](https://www.npmjs.com/package/@fastify/sse)
- [Using Server Sent Events (SSE) with Cloudflare Proxy](https://community.cloudflare.com/t/using-server-sent-events-sse-with-cloudflare-proxy/656279)
- [Remember the problems encountered when deploying ...](https://medium.com/@imrockpan/remember-the-problems-encountered-when-deploying-sse-message-push-to-cloudflare-c3506c42e9e2)
- [Implementing Server-Sent Events with FastAPI, Nginx, and ...](https://blog.devops.dev/implementing-server-sent-events-with-fastapi-nginx-and-cloudflare-10ede1dffc18)
- [nginx Proxy Buffering Issue with /api/events SSE endpoint](https://github.com/mostlygeek/llama-swap/issues/292)
- [Nginx SSE Proxy Configuration: Fix Server-Sent Events ...](https://it-premium.com.ua/en/blog/nginx-proxy-configuration-for-server-sent-events-and-ssl/)
- [Code Sharing: Streaming LLM Results to Browser with SSE](https://www.linkedin.com/pulse/code-sharing-streaming-llm-results-browser-sse-solving-den-lai-a7wsc)
- [LLM Streaming Tutorial: SSE in Python Step-by-Step](https://machinelearningplus.com/gen-ai/llm-streaming-python/)
- [FastAPI Server-Sent Events for LLM Streaming](https://medium.com/@2nick2patel2/fastapi-server-sent-events-for-llm-streaming-smooth-tokens-low-latency-1b211c94cff5)
- [SSE vs WebSockets vs gRPC Streaming for LLM Apps](https://tianpan.co/blog/2026/04/19/sse-websockets-grpc-streaming-llm-applications)
- [Using Server-Sent Events (SSE) to stream LLM responses ...](https://upstash.com/blog/sse-streaming-llm-responses)
- [SSE Streaming Latency Gap: Performance LLM (Chat-GPT ...](https://community.gatling.io/t/sse-streaming-latency-gap-performance-llm-chat-gpt-test-experimental/9789)
- [Building Real-Time Text Streaming with SSE in Node.js](https://dev.to/axrisi/building-real-time-text-streaming-with-sse-in-nodejs-4d5f)
- [SSE vs WebSockets for Streaming LLM Responses](https://www.buildmvpfast.com/blog/streaming-llm-responses-sse-vs-websockets-2026)
- [Benchmarks](https://docs.litellm.ai/docs/benchmarks)
- [Server Sent Events are not working in a nodejs/express app](https://github.com/caddyserver/caddy/issues/3765)
- [I chose SSE over WebSockets for streaming AI responses ...](https://www.reddit.com/r/webdev/comments/1seqym1/i_chose_sse_over_websockets_for_streaming_ai/)
- [Streaming from Node.js to React with Server-Sent Events](https://baransel.dev/post/streaming-nodejs-to-react-with-server-sent-events/)
- [EventSource not working · Issue #35 · chimurai/http-proxy- ...](https://github.com/chimurai/http-proxy-middleware/issues/35)
- [http-proxy-middleware](https://www.npmjs.com/package/http-proxy-middleware)
- [How to use http-proxy-middleware / node- ...](https://stackoverflow.com/questions/71145416/how-to-use-http-proxy-middleware-node-http-proxy-as-a-reverse-proxy)
- [how to create a proxy server in node js implementing custom ...](https://www.youtube.com/watch?v=MCkKLVu1Y74)
- [http-proxy-middleware](https://app.unpkg.com/http-proxy-middleware@0.19.1/files/README.md)
- [Express behind proxies · Express.js 5.x](https://expressjs.com/en/5x/guide/behind-proxies/)
- [HTTP Proxy Libraries for Node.js 2026: Compared](https://www.pkgpulse.com/guides/http-proxy-middleware-vs-node-http-proxy-vs-fastify-2026)
- [Creating a Proxy API for OpenAI's Stream Responses in Node.js](https://blog.gopenai.com/creating-a-proxy-api-for-openais-stream-responses-in-node-js-e2028bb0dc5a)
- [How to Use express-http-proxy to Build Node.js API ...](https://medium.com/p/3a3b144937cc)
- [Streaming chunk of text python/flask in IIS - API](https://community.openai.com/t/streaming-chunk-of-text-python-flask-in-iis/809454)
- [StreamingResponse is returning all content at once #10701](https://github.com/fastapi/fastapi/discussions/10701)
- [Questions about proxying with nginx and keep-alives #3](https://github.com/singingwolfboy/flask-sse/issues/3)
- [SSE event data gets cut off when using Nginx](https://stackoverflow.com/questions/64912788/sse-event-data-gets-cut-off-when-using-nginx)
- [Why are my SSE events only sending on ...](https://www.reddit.com/r/nginx/comments/hmkvde/why_are_my_sse_events_only_sending_on_proxy_read/)
- [Streaming responses - slow in web-hosted version, fast in ...](https://community.openai.com/t/streaming-responses-slow-in-web-hosted-version-fast-in-local-development-version/607161)
- [Fixing Delayed SseEmitter Events with Nginx Proxy Buffering](https://www.youtube.com/watch?v=O9fjtUYW6-g)
- [Stream Server-Sent Events (SSE)](https://docs.openfaas.com/languages/python/examples/sse/)
- [wujianguo/openai-proxy](https://github.com/wujianguo/openai-proxy)
- [Simulating Real-Time Chats using Flask's Server-Sent Events](https://hippocampus-garden.com/flask_sse/)
- [sagemathinc/http-proxy-3: Modern rewrite of node- ...](https://github.com/sagemathinc/http-proxy-3)
- [Streaming edge function hosted in Vercel is buffered by ...](https://community.cloudflare.com/t/streaming-edge-function-hosted-in-vercel-is-buffered-by-cloudflare-proxy/567635)
- [Stream Functionality Issues with Next.js Deployed in a ...](https://github.com/vercel/ai/issues/215)
- [Optimizing a Streaming API](https://objectgraph.com/blog/optimizing-sse-nginx-streaming/)
- [Real-Time Notifications in Python: Using SSE with FastAPI - Medium](https://medium.com/@inandelibas/real-time-notifications-in-python-using-sse-with-fastapi-1c8c54746eb7)
- [How I Implemented End-to-End SSE Streaming: From LLM to ...](https://dev.to/martin_palopoli/how-i-implemented-end-to-end-sse-streaming-from-llm-to-browser-through-nginx-4bjo)
- [Newest 'node-http-proxy' Questions - Stack Overflow](https://stackoverflow.com/questions/tagged/node-http-proxy?tab=Newest)
- [fastify/sse: Server-Sent Events for Fastify](https://github.com/fastify/sse)
- [SSE with nginx holds client connection](https://community.nginx.org/t/sse-with-nginx-holds-client-connection/8470)
- [Node.js Server-Sent-Events - when to use response. ...](https://stackoverflow.com/questions/61799718/node-js-server-sent-events-when-to-use-response-flushheaders-vs-response-wr)
- [Custom Response - HTML, Stream, File, others - FastAPI](https://fastapi.tiangolo.com/advanced/custom-response/)
- [The Complete Guide to Streaming LLM Responses in Web ...](https://dev.to/pockit_tools/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534)
- [Streaming LLM Responses: SSE, WebSocket, JSON (2026)](https://appscale.blog/en/blog/ai-service-pattern-streaming-llm-response-sse-websocket-structured-output-2026)
- [Self-Hosted OpenAI-Compatible Streaming: SSE, ...](https://gigagpu.com/openai-compatible-streaming-self-hosted/)
- [How streaming LLM APIs work](https://til.simonwillison.net/llms/streaming-llm-apis)
- [Streaming Contents — Flask Documentation (3.1.x)](https://flask.palletsprojects.com/en/stable/patterns/streaming/)
- [trotor/openai-assistant-streaming-flask-example - GitHub](https://github.com/trotor/openai-assistant-streaming-flask-example)
- [How to Handle Streaming Responses from the OpenAI API - GoPenAI](https://blog.gopenai.com/how-to-handle-streaming-responses-from-the-openai-api-c6cf470dc2c2)
- [proxy-buffering - Apache APISIX](https://apisix.apache.org/docs/apisix/plugins/proxy-buffering/)
- [Fix SSE Buffering in .NET 10: Disable Proxy Response ...](https://blog.stackademic.com/net-10-sse-in-production-the-proxy-buffering-default-that-turns-real-time-into-batches-cbe49c45c3ad)
- [How to turn off buffering on Nginx Server for Server sent ...](https://stackoverflow.com/questions/61029079/how-to-turn-off-buffering-on-nginx-server-for-server-sent-event)
- [node.js - how to create an http reverse proxy and transform ...](https://stackoverflow.com/questions/60130371/how-to-create-an-http-reverse-proxy-and-transform-the-stream-with-node-js)
- [Stream | Node.js v26.8.2 Documentation](https://nodejs.org/api/stream.html)
- [Streaming Scrape Results in Node.js with SSE](https://fastcrw.com/blog/nodejs-sse-streaming-scrape)
- [EventSource / Server-Sent Events through Nginx - Stack Overflow](https://stackoverflow.com/questions/13672743/eventsource-server-sent-events-through-nginx)
- [How does AI (GPT) use Server Side Events and How it ...](https://www.linkedin.com/pulse/how-does-ai-gpt-use-server-side-events-renders-images-machiraju-gwl5c)
- [Transfer-Encoding chunked and routing seems to cause a problem](https://github.com/chimurai/http-proxy-middleware/issues/324)
- [Why can't I remove the transfer-encoding header in a node proxy?](https://stackoverflow.com/questions/26587731/why-cant-i-remove-the-transfer-encoding-header-in-a-node-proxy)
- [Build a Reverse Proxy in Node.js with http-proxy | Full Tutorial](https://www.youtube.com/watch?v=qhSUB58wx-U)
- [Assistants API Streaming Connection Closure Issue - Bugs](https://community.openai.com/t/assistants-api-streaming-connection-closure-issue/1367634)
- [Cannot disable buffering during SSE connection - nginx](https://serverfault.com/questions/1062696/cannot-disable-buffering-during-sse-connection)
- [disabling output buffering in PHP, Apache, Nginx, and ...](https://www.jeffgeerling.com/blog/2016/streaming-php-disabling-output-buffering-php-apache-nginx-and-varnish/)
- [Cannot disable buffering during SSE connection](https://mailman.nginx.org/pipermail/nginx/2021-May/060655.html)
- [Responses](https://starlette.dev/responses/)
- [StreamingResponse or Websockets? : r/FastAPI](https://www.reddit.com/r/FastAPI/comments/1dfn8f6/streamingresponse_or_websockets/)
- [Streaming Inference with FastAPI and Server-Sent Events](https://blog.redlinesoft.net/posts/streaming-inference-fastapi-sse/)
- [The official Python library for the OpenAI API](https://github.com/openai/openai-python)
- [openai-api-proxy](https://github.com/topics/openai-api-proxy)
- [openai-compatible-proxy-server](https://github.com/topics/openai-compatible-proxy-server?l=python&o=desc&s=forks)
- [Introducing OpenAI HTTP proxy - API](https://community.openai.com/t/introducing-openai-http-proxy/1362633)
- [openai-compatible · GitHub Topics](https://github.com/topics/openai-compatible)
- [aws-samples/bedrock-access-gateway](https://github.com/aws-samples/bedrock-access-gateway)
- [I just released an open-source OpenAI-compatible reverse ...](https://github.com/orgs/community/discussions/191950)
- [Server-Sent Events with Express](https://masteringjs.io/tutorials/express/server-sent-events)
- [Realtime fails when behind nginx proxy · Issue #488](https://github.com/pocketbase/pocketbase/issues/488)
- [Fastify Server-Sent Events(SSE) - Edison Devadoss - Medium](https://edisondevadoss.medium.com/fastify-server-sent-events-sse-93de994e013b)
- [FastAPI StreamingResponse not streaming with generator ...](https://sentry.io/answers/fastapi-streamingresponse-not-streaming-with-generator-function/)
- [JSONL streaming responses miss the anti-buffering ...](https://github.com/fastapi/fastapi/discussions/15794)
- [Understanding node streams, back-pressure ... the hard way - ey3ball](http://ey3ball.github.io/posts/2014/07/17/node-streams-back-pressure/)
- [Use Streams to Build High-Performing Node.js Applications](https://blog.appsignal.com/2022/02/02/use-streams-to-build-high-performing-nodejs-applications.html)
- [LLM Output Streaming and Real-Time Token Delivery ...](https://zylos.ai/research/2026-03-28-llm-output-streaming-token-delivery-architectures/)
- [Understand LLM latency and throughput metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics)
- [AI Token Streaming: From SSE to Durable Sessions](https://websocket.org/guides/use-cases/ai-streaming/)
- [Blink: CPU-Free LLM Inference by Delegating the Serving ...](https://arxiv.org/html/2604.07609v1)
- [LLM API Provider Performance KPIs 101](https://deepinfra.com/blog/llm-api-provider-performance-kpis-101)
- [Real-time LLMs: Optimizing latency in streaming - Latitude.so](https://latitude.so/blog/real-time-llms-optimizing-latency-streaming)
- [Research Track Oral Presentation: LLM Serving 1](https://mlsys.org/virtual/2026/session/3675)
- [Problems with SSE and chunked encoding + gzip #371](https://github.com/chimurai/http-proxy-middleware/issues/371)
- [Problem with streaming SSE server behind traefik](https://community.traefik.io/t/problem-with-streaming-sse-server-behind-traefik/23007)
- [Implementing AI Streaming Responses with JSON Lines ...](https://dev.to/tilfin/implementing-ai-streaming-responses-with-json-lines-chunked-communication-instead-of-sse-3la9)
- [FastAPI SSE working Locally but not in Azure Web App?](https://stackoverflow.com/questions/78584265/fastapi-sse-working-locally-but-not-in-azure-web-app)
- [Problem with eventloop: Server sent events are buffered](https://forum.hestiacp.com/t/problem-with-eventloop-server-sent-events-are-buffered/3758)
- [sse events not being sent to the front-end : r/learnpython](https://www.reddit.com/r/learnpython/comments/1qjv3lu/sse_events_not_being_sent_to_the_frontend/)
- [How to Implement SSE with Different Frameworks](https://oneuptime.com/blog/post/2026-01-27-sse-different-frameworks/view)
- [NGINX Optimization for Server-Sent Events (SSE)](https://www.digitalocean.com/community/questions/nginx-optimization-for-server-sent-events-sse)
- ["keep alive" `ping` comments are not emitted when directly ...](https://github.com/fastapi/fastapi/discussions/15441)
- [StreamingResponse and SSE broken on FastAPI : Forums](https://eu.pythonanywhere.com/forums/topic/572/)
- [CORS (Cross-Origin Resource Sharing) - FastAPI](https://fastapi.tiangolo.com/tutorial/cors/)
- [chat-completions](https://github.com/topics/chat-completions?o=desc&s=forks)
- [openai-compatible-proxy-server](https://github.com/topics/openai-compatible-proxy-server?o=desc&s=forks)
- [starhunt/star-cliproxy: OpenAI- & Anthropic-compatible API ...](https://github.com/starhunt/star-cliproxy)
- [Nayjest/lm-proxy: OpenAI-compatible HTTP LLM ...](https://github.com/Nayjest/lm-proxy)
- [How to stream OpenAI Assistants API v1 response in Python ...](https://www.youtube.com/watch?v=d8dsFlLATrw)
- [SDKs and CLI | OpenAI API](https://developers.openai.com/api/docs/libraries)
- [Ecosystem — Fastify plugins](https://fastify.dev/ecosystem/)
- [Ecosystem — Fastify latest](https://fastify.dev/docs/latest/Guides/Ecosystem/)
- [fastify-sse](https://www.npmjs.com/package/fastify-sse)
- [glance-vault - GitHub](https://github.com/glance-apps/glance-vault)
- [sub2api-plus/deploy/EDGE_SECURITY.md at main - GitHub](https://github.com/LuckyKuang/sub2api-plus/blob/main/deploy/EDGE_SECURITY.md)
- [3.0 - Server dislikes our behavior, excessive load detected. #734](https://github.com/opencloud-eu/desktop/issues/734)
- [Server-sent events and streaming APIs | Fern Documentation](https://buildwithfern.com/learn/api-definitions/openapi/endpoints/sse)
- [Building ChatGPT-Style Streaming in React: FastAPI + Next.js ...](https://ranjankumar.in/building-chatgpt-style-streaming-in-react-fastapi-next-js-production-guide)
- [LLM Inference Benchmarking: Performance Tuning with ...](https://developer.nvidia.com/blog/llm-inference-benchmarking-performance-tuning-with-tensorrt-llm/)
- [Fastest LLM Inference APIs in 2026: TTFT and Throughput ...](https://inworld.ai/resources/fastest-llm-inference-api)
- [LLM Benchmark](https://www.pythonsheets.com/notes/llm/llm-bench.html)
- [StreamingResponse generater throws exception, how to ...](https://github.com/fastapi/fastapi/discussions/10138)
- [Server Sent Events - Tokopedia Engineering](https://medium.com/tokopedia-engineering/server-sent-events-26f75e3a5ed2)
- [SSE streaming responses buffered entirely by edge proxy](https://station.railway.com/questions/sse-streaming-responses-buffered-entirel-5b2916c5)
- [Github API, fetch the top most starred public repositories that is ...](https://stackoverflow.com/questions/53564470/github-api-fetch-the-top-most-starred-public-repositories-that-is-written-in-py)
- [openai-python/src/openai/_streaming.py at main - GitHub](https://github.com/openai/openai-python/blob/main/src/openai/_streaming.py)
- [github-stars · GitHub Topics](https://github.com/topics/github-stars?l=python)
- [Explore supporting SSE (Server-Sent Events) streaming for LLM](https://github.com/kserve/kserve/issues/2788)
- [Malformed streaming answers from GPT-4 completions API ...](https://community.openai.com/t/malformed-streaming-answers-from-gpt-4-completions-api-lately/481686)
- [Does The HTTP Response Stream Need Error Event ...](https://www.bennadel.com/blog/2823-does-the-http-response-stream-need-error-event-handlers-in-node-js.htm)
- [How We Stream SSE Through 3 Proxies Without Buffering](https://kiwiclaw.app/blog/how-we-stream-sse-through-three-proxies/)
- [Streaming ChatGPT API responses with python and JavaScript](https://dev.to/jethrolarson/streaming-chatgpt-api-responses-with-python-and-javascript-22d0)
- [IT-lexikon · 5700+ termer förklarade på svenska | Thern AI Solutions](https://wiki.thern.io/)
- [Fixing SSE Buffering Issues with Nginx and Apache - LinkedIn](https://www.linkedin.com/posts/srikanthrmn_systemarchitecture-softwareengineering-activity-7482384322742878208-G4I5)
- [Buffering breaks event streams · Issue #1505 · nginx/nginx](https://github.com/nginx/nginx/issues/1505)
- [LLM Streaming Latency: Cut TTFT, Smooth Tokens, Fix ...](https://medium.com/@QuarkAndCode/llm-streaming-latency-cut-ttft-smooth-tokens-fix-cold-starts-f2be60d26b89)
- [LLM inference latency: TTFT, tokens per second, and what ...](https://clickhouse.com/resources/engineering/llm-inference-latency)
- [Best Low Latency AI Inference APIs of 2026](https://rtcleague.com/blogs/best-low-latency-ai-inference-apis-2026)
- [Benchmarking LLMs - TrueFoundry Docs](https://www.truefoundry.com/docs/benchmarking-llms)
- [Was there an intentional change to the streaming ...](https://community.openai.com/t/was-there-an-intentional-change-to-the-streaming-responses-multiple-chunks-in-stream-event/603960)
- [OpenAI-compatible streaming: missing terminal chunk ...](https://github.com/openclaw/openclaw/issues/4298)
- [How to stream LLM responses with server-sent events](https://flaviocopes.com/streaming-llm-responses-sse/)
- [Server-sent event in traefik - too many transfer encoding ...](https://github.com/traefik/traefik/issues/8623)
- [Chunking not functioning as expected - Traefik v2](https://community.traefik.io/t/chunking-not-functioning-as-expected/26543)
- [Chat Completions streaming events | OpenAI API Reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events/)
- [Specification - Open Responses](https://www.openresponses.org/specification)
- [javascript - How to use server-sent-events in express.js ...](https://stackoverflow.com/questions/34657222/how-to-use-server-sent-events-in-express-js)
- [LLM Streaming SSE Implementation: The Complete Guide](https://www.xyc.ai/news/en/2026-06-27-llm-streaming-sse-frontend-rendering-guide/)
- [Streaming SSE Proxying for LLM APIs: The Hard Parts](https://preto.ai/blog/streaming-sse-proxy/)
- [Chunking not functioning as expected](https://community.traefik.io/t/chunking-not-functioning-as-expected/26543/7)
- [FastAPI Streaming Response: Error: Did not receive done ...](https://kontext.tech/project/python/article/fastapi-streaming-response-error-did-not-receive-done-or-success-response-in-stream)
- [Zero response through http-proxy-middleware](https://stackoverflow.com/questions/52270848/zero-response-through-http-proxy-middleware)
- [StreamingResponse OpenAI and maybe not Celery?](https://www.reddit.com/r/FastAPI/comments/186z4hf/streamingresponse_openai_and_maybe_not_celery/)
- [assistant streaming slow · Issue #1485 · openai ...](https://github.com/openai/openai-python/issues/1485)
- [v1/audio/speech with stream_format=sse returns raw ...](https://github.com/BerriAI/litellm/issues/24301)
- [SSE Stream parser expects additional space after colon ...](https://github.com/openai/openai-python/issues/498)
- [Server-sent events buffering - Cloudflare Community](https://community.cloudflare.com/t/server-sent-events-buffering/179526)
- [Vercel AI SDK not streaming responses in production but working ...](https://www.reddit.com/r/nextjs/comments/1d3x76h/vercel_ai_sdk_not_streaming_responses_in/)
- [Dependencies with yield not working with StreamingResponse](https://github.com/fastapi/fastapi/discussions/11444)
- [How to (or should we) use context managers in path operators ...](https://github.com/fastapi/fastapi/issues/1936)
- [iter_bytes w/ chunk_size ignores last non-full chunk #3543 - GitHub](https://github.com/encode/httpx/discussions/3543)
- [with_cancellation can return None, causing FastAPI to send HTTP ...](https://github.com/vllm-project/vllm/issues/42794)
- [HTTP/2 GOAWAY event crashes application (Undici v6.20.1) #3753](https://github.com/nodejs/undici/issues/3753)
- [Response Data is Showing as Buffer · chimurai http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware/discussions/893)
- [Undici fetch bypasses proxy (created with proxy npm package) #3509](https://github.com/nodejs/undici/issues/3509)
- [Streaming response : r/FastAPI](https://www.reddit.com/r/FastAPI/comments/1d1vd8d/streaming_response/)
- [aws/chalice - Support for SSE streaming (OpenAI support)](https://github.com/aws/chalice/issues/2078)
- [YouTube](https://www.youtube.com/watch?v=ZOjR11gXo5o&vl=en-US)
- [Streaming - OpenAI Agents SDK](https://openai.github.io/openai-agents-python/streaming/)
- [docs/docs/reference/https/nginx.md at main · open-webui/docs](https://github.com/open-webui/docs/blob/main/docs/reference/https/nginx.md)
- [How to Proxy and Modify OpenAI Stream Responses for Enhanced ...](https://dev.to/timhub/how-to-proxy-and-modify-openai-stream-responses-for-enhanced-user-experience-16p1)
- [Runtimes - Vercel](https://vercel.com/docs/functions/runtimes)
- [Reverse Proxy Servers and Vercel](https://vercel.com/docs/security/reverse-proxy)
- [Should I use Cloudflare in front of Vercel?](https://vercel.com/kb/guide/cloudflare-with-vercel)
- [aimock/CHANGELOG.md at main · CopilotKit/aimock - GitHub](https://github.com/CopilotKit/llmock/blob/main/CHANGELOG.md)
- [Use FastAPI EventSourceResponse in UIEventStream ... - GitHub](https://github.com/pydantic/pydantic-ai/issues/4493)
- [FastAPI + SSE for LLM Tokens: Smooth Streaming without ... - Medium](https://medium.com/@hadiyolworld007/fastapi-sse-for-llm-tokens-smooth-streaming-without-websockets-001ead4b5e53)
- [What's the difference StreamingResponse or EventSourceResponse?](https://stackoverflow.com/questions/77926208/whats-the-difference-streamingresponse-or-eventsourceresponse)
- [Server-Sent Events - EventSourceResponse and ServerSentEvent](https://fastapi.tiangolo.com/reference/sse/)
- [llm-proxy · GitHub Topics](https://github.com/topics/llm-proxy?o=desc&s=forks)
- [pawamoy/stars: My stars on GitHub, grouped by language.](https://github.com/pawamoy/stars)
- [Top Python Libraries of 2025 - Edge AI and Vision Alliance](https://www.edge-ai-vision.com/2026/01/top-python-libraries-of-2025/)
- [KeepRoLLMing 0.9.2 is out! - Facebook](https://www.facebook.com/groups/994836635288249/posts/1523105119128062/)
- [stars/README.md at master · pluja/stars - GitHub](https://github.com/pluja/stars/blob/master/README.md)
- [New Project Megathread - Week of 18 Jun 2026 : r/selfhosted - Reddit](https://www.reddit.com/r/selfhosted/comments/1u9jtvm/new_project_megathread_week_of_18_jun_2026/)
- [[ICML 2026] effGen: Enabling Small Language Models as ... - GitHub](https://github.com/ctrl-gaurav/effGen)
- [OpenAI adds MCP support to Agents SDK - Hacker News](https://news.ycombinator.com/item?id=43485566)
- [My journey to Make something which actually solves a problem.](https://www.facebook.com/groups/vibecodinglife/posts/1983374395584421/)
- [Justin Mclean's Post - apache/airflow-steward - LinkedIn](https://www.linkedin.com/posts/justinmclean_github-apacheairflow-steward-agent-assisted-activity-7464866634994835456-1PhN)
- [FastAPI Streaming Responses: Real-Time Without ...](https://medium.com/@bhagyarana80/fastapi-streaming-responses-real-time-without-websockets-bc6b071f5d9e)
- [🚀 Streaming in Node.js: A Complete Guide with Examples](https://medium.com/@rohitjsingh16/streaming-in-node-js-a-complete-guide-with-examples-9dae48de4d85)
- [nodejs — streams — passthrough - Danny Dai](https://medium.com/@dannz_51927/nodejs-streams-passthrough-c993e86bb4f1)
- [feat(infra): nginx reverse proxy config with TLS termination for ...](https://github.com/Telocel-Labs/Trident/issues/140)
- [sample-pellier-agentic-search-apg/scripts/bootstrap-environment.sh ...](https://github.com/aws-samples/sample-pellier-agentic-search-apg/blob/main/scripts/bootstrap-environment.sh)
- [Swift: Streaming OpenAI API Response (Chunked Encoding Transfer)](https://blog.stackademic.com/swift-streaming-openai-api-response-chunked-encoding-transfer-48b7f1785f5f)
- [Bug: SSE Stream Crashes on Empty Events (retry directives ... - GitHub](https://github.com/openai/openai-go/issues/556)
- [My own awesome project list based on starred projects · GitHub](https://github.com/paulosuzart/awesome)
- [Project ideas for 2026 · openvinotoolkit/openvino Wiki - GitHub](https://github.com/openvinotoolkit/openvino/wiki/Project-ideas-for-2026)
- [kstevica/captain-claw: Self-hosted framework for orchestrating fleets ...](https://github.com/kstevica/captain-claw)
- [CodeBuddy - An Autonomous AI Software Engineer · GitHub](https://github.com/olasunkanmi-SE/codebuddy)
- [Matt Van Horn (mvanhorn) - GitHub](https://github.com/mvanhorn)
- [GitHub - Zaid-maker/my-awesome-stars-list](https://github.com/Zaid-maker/my-awesome-stars-list)
- [Real-Time AI Responses with FastAPI SSE - Andrii Peretiatko](https://www.peretyatkosdet.com/blog/fastapi-sse-streaming-ai-responses)
