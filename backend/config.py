import os
from dotenv import load_dotenv
from pathlib import Path
from openai import AsyncOpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
EBAY_CLIENT_ID = os.environ.get('EBAY_CLIENT_ID')
EBAY_CLIENT_SECRET = os.environ.get('EBAY_CLIENT_SECRET')
EBAY_RUNAME = os.environ.get('EBAY_RUNAME')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')

openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
