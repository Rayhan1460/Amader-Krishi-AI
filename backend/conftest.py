import os
import sys
from pathlib import Path

# Set local Keras home and disable oneDNN op warning before any test imports
backend_dir = Path(__file__).resolve().parent
keras_dir = backend_dir / ".keras"
keras_dir.mkdir(parents=True, exist_ok=True)

os.environ["KERAS_HOME"] = str(keras_dir)
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

