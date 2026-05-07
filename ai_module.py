"""
AI Module for Mediclean Pro.
Connects to local Ollama instance for intelligent business automation.
"""
import requests
import json
import time
import database as db

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma3:4b"

SYSTEM_PROMPT = """Du bist der MediClean Pro® KI-Assistent. Du arbeitest für ein professionelles Reinigungsunternehmen in Wien.

Deine Aufgaben:
1. TERMINPLANUNG: Du hilfst Kunden, Reinigungstermine zu buchen (Mo-Fr 08:00-18:00)
2. REINIGUNGSHILFE: Du beantwortest Fragen zu Reinigungsmethoden, Produkten und Hygiene
3. KUNDENSERVICE: Du beantwortest allgemeine Fragen freundlich und professionell
4. ANGEBOTSERSTELLUNG: Du kannst grobe Kostenvoranschläge geben

Wichtige Regeln:
- Antworte IMMER auf Deutsch
- Sei professionell aber freundlich, per "Sie"
- Halte Antworten kurz und präzise (max 3-4 Sätze)
- Bei Terminwünschen: Frage nach Datum, Uhrzeit und Art der Reinigung
- Bei Preisfragen: Gib Richtwerte (Ordination: ab €150, Büro: ab €80, Privathaushalt: ab €60)
- Erwähne bei komplexen Fragen: "Für ein individuelles Angebot kontaktieren Sie uns unter +43 664 99533780"
- Du darfst KEINE medizinischen Ratschläge geben
"""

CLEANING_ASSISTANT_PROMPT = """Du bist der interne KI-Assistent für MediClean Pro® Reinigungskräfte.

Deine Aufgaben:
1. CHECKLISTEN: Erstelle Reinigungschecklisten für verschiedene Raumtypen
2. PRODUKTE: Empfehle die richtigen Reinigungsmittel und Dosierungen
3. HYGIENE: Erkläre Desinfektionsprotokolle nach ÖNORM D 2050
4. PROBLEME: Hilf bei hartnäckigen Verschmutzungen
5. SICHERHEIT: Weise auf Arbeitsschutzmaßnahmen hin

Antworte IMMER auf Deutsch, kurz und praxisnah. Verwende Aufzählungen wenn möglich.
"""

def query_ollama(prompt, system_prompt=SYSTEM_PROMPT, context=None):
    """Send a prompt to Ollama and return the response."""
    try:
        payload = {
            "model": MODEL,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "num_predict": 500
            }
        }
        if context:
            payload["context"] = context
        
        resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "success": True,
                "response": data.get("response", ""),
                "context": data.get("context", []),
                "model": MODEL,
                "eval_duration_ms": data.get("eval_duration", 0) // 1_000_000
            }
        else:
            return {"success": False, "message": f"Ollama error: {resp.status_code}"}
    except requests.ConnectionError:
        return {"success": False, "message": "KI-Service nicht verfügbar (Ollama nicht gestartet)"}
    except requests.Timeout:
        return {"success": False, "message": "KI-Anfrage Timeout — bitte erneut versuchen"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def customer_chat(message, context=None, user_data=None):
    """Customer-facing AI chat for appointment booking and general inquiries."""
    custom_prompt = SYSTEM_PROMPT
    if user_data:
        try:
            profile = json.loads(user_data.get('profile_data', '{}'))
            name = profile.get('contact') or user_data.get('username')
            company = profile.get('company', '')
            address = f"{profile.get('street', '')}, {profile.get('zip', '')} {profile.get('city', '')}".strip(" ,")
            
            custom_prompt += f"\n\nWICHTIGE KUNDENDATEN FÜR DIESEN CHAT:\n"
            custom_prompt += f"Du sprichst gerade mit: {name}\n"
            if company: custom_prompt += f"Firma/Objekt: {company}\n"
            if address: custom_prompt += f"Adresse: {address}\n"
            custom_prompt += "Nutze diese Informationen, um den Kunden persönlich anzusprechen und bei Terminanfragen direkt zu wissen, wo die Reinigung stattfinden soll. Frage NICHT nach der Adresse, wenn du sie hier schon siehst."
        except Exception:
            pass
            
    return query_ollama(message, custom_prompt, context)

def staff_chat(message, context=None):
    """Internal AI assistant for cleaning staff."""
    return query_ollama(message, CLEANING_ASSISTANT_PROMPT, context)

def generate_checklist(room_type):
    """Generate a cleaning checklist for a specific room type."""
    prompt = f"Erstelle eine detaillierte Reinigungscheckliste für: {room_type}. Format als nummerierte Liste."
    return query_ollama(prompt, CLEANING_ASSISTANT_PROMPT)

def analyze_appointment_request(message):
    """Extract appointment details from a natural language message."""
    prompt = f"""Analysiere diese Terminanfrage und extrahiere die Informationen als JSON:
Nachricht: "{message}"

Antworte NUR mit einem JSON-Objekt in diesem Format:
{{"datum": "TT.MM.JJJJ oder null", "uhrzeit": "HH:MM oder null", "typ": "ordination/buero/privathaushalt/grund/fenster oder null", "notizen": "zusätzliche Infos"}}"""
    
    result = query_ollama(prompt, SYSTEM_PROMPT)
    if result["success"]:
        try:
            # Try to extract JSON from response
            text = result["response"]
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                parsed = json.loads(text[start:end])
                result["parsed"] = parsed
        except (json.JSONDecodeError, ValueError):
            result["parsed"] = None
    return result

def generate_offer(service_type, area_sqm=None, frequency=None):
    """Generate a rough cost estimate."""
    prompt = f"""Erstelle einen kurzen Kostenvoranschlag für:
- Dienstleistung: {service_type}
- Fläche: {area_sqm or 'nicht angegeben'} m²
- Häufigkeit: {frequency or 'einmalig'}

Gib eine Preisspanne an und erwähne, dass ein individuelles Angebot unter +43 664 99533780 angefragt werden kann."""
    return query_ollama(prompt, SYSTEM_PROMPT)
