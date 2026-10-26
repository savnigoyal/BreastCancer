import sys
import os

# Add nested folder to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "AI-Breast-Cancer-Care--main"))

from app import app

if __name__ == "__main__":
    app.run()
