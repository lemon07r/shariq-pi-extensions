# Performance Status

Adds one compact footer-area status row for the current or latest assistant response.

It reports TPS, time to first token, elapsed response time, response output tokens, and the active tool. Live token counts and TPS are estimates until the provider returns final usage. Final TPS is provider-reported output tokens divided by the time from the first streamed delta to message completion. When a provider counts reasoning it does not stream, those tokens enter the count without their time, so TPS reads high. TTFT and elapsed time start at the provider HTTP call, not at local request preparation, and cover provider latency, prefill, and unstreamed reasoning. Parallel tool calls are tracked individually.
