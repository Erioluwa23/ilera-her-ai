YarnGPT tokenizer and speaker prompts: saheedniyi02/yarngpt at 8bb0eb27d307f4b5903149e24ecc1bd3caa4af2d, MIT per upstream README.

Decoder-only subset copied from outetts 0.2.3 PyPI wheel; package entrypoint excludes unrelated generation and ASR engines. See bundled license. Compatibility change: checkpoint loader explicitly uses weights_only=False for torch 2.8; app verifies the original checkpoint SHA256 before loading.

YarnGPT2b weights: saheedniyi/YarnGPT2b, Apache 2.0. Decoder configuration uses the original YarnGPT model-card source. The checkpoint uses the original `novateur/WavTokenizer-large-speech-75token` Hub upload pinned to revision `1cc9faee31025548fbae6ffe11115d7207093638`, with the same SHA256 (`7450020c154f6aba033cb8651466cb79cb1b1cdd10ea64eaba68e7871cabcc5a`) as the author-linked Google Drive checkpoint. The bytes remain the same; their hash is verified before loading. This avoids reliance on a mutable main branch or a Google Drive retrieval screen.

Pinned checkpoint: https://huggingface.co/novateur/WavTokenizer-large-speech-75token/blob/1cc9faee31025548fbae6ffe11115d7207093638/wavtokenizer_large_speech_320_24k.ckpt
