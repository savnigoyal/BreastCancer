import sys
import os

# Ensure parent directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app

# Export for Vercel
if __name__ == "__main__":
    app.run()
