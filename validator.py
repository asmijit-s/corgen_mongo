# validator.py

import re
from typing import List, Dict, Optional
from pydantic import BaseModel
from enum import Enum
from serpapi import GoogleSearch 
from dotenv import load_dotenv  
import os
import spacy
from google import genai
from google.genai.types import GenerateContentConfig, Content, Part
import json

# ------------------- Environment -------------------
load_dotenv()

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
nlp = spacy.load("en_core_web_sm")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

# ------------------- LLM Validity Schema -------------------
class ValidityEnum(str, Enum):
    valid = "valid"
    partially_valid = "partially valid"
    invalid = "invalid"

class Validity(BaseModel):
    validity: ValidityEnum
    confidence: float  # between 0.0 and 1.0
    contradiction: Optional[bool] = None
    suggestion: Optional[str] = None


class ValidationResult(BaseModel):
    contentChunk: str
    matchedKeyword: Optional[str]
    validity: ValidityEnum
    confidence: Optional[float] = None
    suggestion: Optional[str] = None
    evidence: Optional[str] = None
    factual_density: Optional[float] = None
    contradiction: Optional[bool] = None


class ValidationSummary(BaseModel):
    total_chunks: int
    valid_count: int
    partially_valid_count: int
    invalid_count: int
    overall_validity: str
    avg_confidence: Optional[float] = None


class ValidateContentInput(BaseModel):
    content: str
    activity_name: str
    activity_type: str  # e.g., "reading", "lecture"


class ValidateContentOut(BaseModel):
    summary: ValidationSummary
    detailedReport: List[ValidationResult]

def compare_with_gemini(generated_content: str, activity_name: str, search_content: str) -> Optional[Dict]:
    system_prompt = f"""
You are an expert content validator. Your task is to evaluate the generated content against the activity name and search content.
- **Activity Name**: {activity_name}
- **Search Content**: {search_content}
- **Generated Content**: {generated_content}

- Use only the search content as evidence.
- Focus on factual correctness.
- Identify any factual contradictions. Mark 'contradiction: true' if the generated content clearly conflicts with search evidence.
- Return your assessment as a JSON object following the given schema:
  - validity: "valid" | "partially valid" | "invalid"
  - confidence: 0.0 to 1.0
  - contradiction: true or false
  - suggestion: correction if needed (optional)
"""

    user_prompt = Content(
        role="user",
        parts=[
            Part(text="Validate the following content."),
        ]
    )
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_prompt,
            config=GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=Validity
            )
        )

        parsed_response = None
        if response.text is not None:
            parsed_response = json.loads(response.text)
        return parsed_response

    except Exception as e:
        print(f"LLM call failed: {e}")
        return None

# ------------------- Web Search -------------------
def search_web_snippets(query: str, num_results: int = 5) -> List[str]:
    params = {
        "engine": "google",
        "q": query,
        "api_key": SERPAPI_API_KEY,
        "num": num_results
    }
    search = GoogleSearch(params)
    results = search.get_dict()
    snippets = []
    for result in results.get("organic_results", []):
        if "snippet" in result:
            snippets.append(result["snippet"])
    return snippets

def extract_keywords_spacy(generated_content: str) -> List[str]:
    doc = nlp(generated_content)
    keywords = set()
    for ent in doc.ents:
        if ent.label_ in ("ORG", "PERSON", "GPE", "PRODUCT", "EVENT", "WORK_OF_ART", "LAW", "LANGUAGE"):
            keywords.add(ent.text.strip())
    for np in doc.noun_chunks:
        if 2 <= len(np.text.strip()) <= 80:
            keywords.add(np.text.strip())
    return list(keywords)

def estimate_factual_density(text: str) -> float:
    doc = nlp(text)
    num_entities = len(doc.ents)
    num_numbers = len(re.findall(r'\d+(\.\d+)?', text))
    citation_like = len(re.findall(r"(according to|et al\.|ref(erence)?|source:|study)", text, flags=re.I))
    num_tokens = len(doc)

    if num_tokens == 0:
        return 0.0

    density_score = (0.5 * num_entities + 0.3 * num_numbers + 0.2 * citation_like) / num_tokens
    return min(density_score, 1.0)

def chunk_markdown(text: str, max_sentences: int = 5) -> List[str]:
    sentences = re.split(r'(?<=[.!?]) +', text)
    chunks = []
    for i in range(0, len(sentences), max_sentences):
        chunk = " ".join(sentences[i:i+max_sentences]).strip()
        if chunk:
            chunks.append(chunk)
    return chunks

def validate_content_with_keywords(content: str, activity_name: str, activity_type: str) -> List[Dict]:
    keyword_candidates = [activity_name] + extract_keywords_spacy(content)
    keyword_candidates = list(set([k for k in keyword_candidates if len(k.strip()) > 2]))

    keyword_to_snippets = {k: search_web_snippets(k) for k in keyword_candidates}
    chunks = chunk_markdown(content)

    report = []
    for chunk in chunks:
        matched_kw = next((k for k in keyword_candidates if k.lower() in chunk.lower()), None)
        evidence = "\n".join(keyword_to_snippets.get(matched_kw, [])) if matched_kw else ""
        validity_result = compare_with_gemini(chunk, activity_name, evidence)
        factual_density = estimate_factual_density(chunk)

        report.append({
            "contentChunk": chunk,
            "matchedKeyword": matched_kw,
            "factualDensity": factual_density,
            "validity": validity_result.get("validity", "unknown") if validity_result else "error",
            "confidence": validity_result.get("confidence", 0.0) if validity_result else 0.0,
            "contradiction": validity_result.get("contradiction", False) if validity_result else None,
            "suggestion": validity_result.get("suggestion") if validity_result else "LLM error or no response",
            "evidence": evidence
        })

    return report

def summarize_validation_report(report: List[ValidationResult]) -> ValidationSummary:
    total = len(report)
    valid = sum(1 for r in report if r.validity == "valid")
    partial = sum(1 for r in report if r.validity == "partially valid")
    invalid = sum(1 for r in report if r.validity == "invalid")

    overall_validity = "valid" if valid == total else "invalid" if invalid > 0 else "partially valid"

    return ValidationSummary(
        total_chunks=total,
        valid_count=valid,
        partially_valid_count=partial,
        invalid_count=invalid,
        overall_validity=overall_validity,
        avg_confidence=sum(r.confidence for r in report if r.confidence is not None) / total if total else 0.0
    )