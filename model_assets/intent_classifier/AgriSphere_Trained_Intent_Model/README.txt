
AGRISPHERE AI - MULTILINGUAL INTENT MODEL

Included:
1. Trained agriculture intent classifier
2. Full pretrained multilingual encoder
3. Evaluation and training metadata
4. Training examples snapshot (if available)
5. Inference Python script
6. Python requirements

USAGE:

pip install -r requirements.txt

python predict.py "আমার ধানের পাতায় দাগ কেন?"

LIMITATIONS:

This is a 13-category multilingual intent classifier,
not a complete generative Agriculture AI assistant.

Training used 117 demonstration questions.

Previously observed holdout Macro F1: 0.519.

Bengali, Banglish and English require further testing
with independent real-world labelled questions.

This package does not contain other specialized models,
frontend code, backend code or API integrations.

The encoder is pretrained, not fine-tuned here.
