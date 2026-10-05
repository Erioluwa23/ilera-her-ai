YarnGPT tokenizer and speaker prompts: saheedniyi02/yarngpt at 8bb0eb27d307f4b5903149e24ecc1bd3caa4af2d, MIT per upstream README.

Decoder-only subset copied from outetts 0.2.3 PyPI wheel; package entrypoint excludes unrelated generation and ASR engines. See bundled license. Compatibility change: checkpoint loader explicitly uses weights_only=False for torch 2.8; app verifies the original checkpoint SHA256 before loading.

YarnGPT2b weights: saheedniyi/YarnGPT2b, Apache 2.0. Decoder checkpoint and configuration use the original YarnGPT model-card download sources. Checkpoint SHA256 is verified before loading.
