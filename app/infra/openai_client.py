import os
from openai import OpenAI

def get_openai_client(user_api_key: str | None):
    if user_api_key:
        return OpenAI(api_key=user_api_key)
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))