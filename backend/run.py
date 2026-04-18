"""
PyInstaller entry point for the FastAPI backend.

multiprocessing.freeze_support() MUST be called before anything else on Windows.
Without it, spawning the frozen exe triggers an infinite loop of child processes.
"""
import multiprocessing
multiprocessing.freeze_support()

import uvicorn
from app.main import app

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
