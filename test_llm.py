import urllib.request
import json

text = """
LEIMER Benjamin
Wien, Österreich | +43 123 456 | benjamin.leimer@example.com
Softwareentwickler

Zusammenfassung
Erfahrener Entwickler mit Fokus auf KI und Web.

Erfahrung
Senior Developer bei TechCorp (Jan 2020 - Heute)
- Entwicklung von RAG-Systemen
- Frontend mit React

Ausbildung
TU Wien, Informatik BSc (2015 - 2019)

Skills
Python, JavaScript, Docker
"""

prompt = f"""Extrahiere die Informationen aus dem Lebenslauf. Antworte AUSSCHLIESSLICH mit gültigem JSON nach diesem Schema:
{{
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "title": "string",
    "summary": "string",
    "skills": ["string"],
    "experience": [{{"role": "string", "company": "string", "date": "string", "description": "string"}}],
    "education": [{{"degree": "string", "institution": "string", "date": "string"}}]
}}
Lebenslauf:
{text}
"""

req = urllib.request.Request("http://localhost:11434/api/generate", json.dumps({
    "model": "gemma3:4b",
    "prompt": prompt,
    "system": "Du bist ein JSON-Extraktor. Antworte NUR mit JSON.",
    "format": "json",
    "stream": False,
    "options": {"temperature": 0.1}
}).encode(), {"Content-Type": "application/json"})

resp = urllib.request.urlopen(req)
print(json.loads(resp.read())["response"])
