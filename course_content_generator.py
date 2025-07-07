# course_content_generator.py

import os
import re
import json
import requests
from typing import List, Dict, Union, Optional, Type
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from pydantic import BaseModel
import PyPDF2
from google import genai
from google.genai.types import GenerateContentConfig, Content, Part
# Load environment
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

# ----------------------------- Constants -----------------------------
MAX_CHARS_PER_CONTEXT = 12000

# ----------------------------- Utility Functions -----------------------------

def read_file(path: str, mode: str = "r", encoding: Optional[str] = "utf-8") -> str:
    try:
        with open(path, mode, encoding=encoding) as f:
            return f.read().strip()
    except Exception as e:
        raise ValueError(f"Failed to read file: {e}")

def extract_text_from_pdf(pdf_path: str) -> str:
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            return "".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {e}")

def extract_text_from_txt(txt_path: str) -> str:
    try:
        with open(txt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception as e:
        raise ValueError(f"Failed to read text file: {e}")

def scrape_text_from_url(url: str) -> str:
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.content, "html.parser")
        for tag in soup(["script", "style"]):
            tag.extract()
        return soup.get_text(separator="\n").strip()
    except Exception as e:
        raise ValueError(f"Failed to scrape URL '{url}': {e}")

def clean_text(text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'https?://\S{80,}', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def truncate_text(text: str, max_chars: int = MAX_CHARS_PER_CONTEXT) -> str:
    return text[:max_chars] if len(text) > max_chars else text

# ----------------------------- LLM Interaction -----------------------------

def call_gemini(prompt: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    raw = response.text.strip() if response.text else ""
    return re.sub(r'^```(?:json)?|```$', '', raw.strip())

def call_llm(prompt: Content, system_prompt: str, response_schema: Type[BaseModel], debug: bool = False, temp: float = 0.2) -> Optional[dict]:
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=temp
            )
        )
        if debug or True:  # force debug always for now
            print(f"\n=== LLM RAW RESPONSE ===\n{response.text}\n=== END ===\n")

        parsed_response = None
        if response.text is not None:
            parsed_response = json.loads(response.text)
        return parsed_response

    except Exception as e:
        print(f"LLM call failed: {e}")
        return None

# ----------------------------- Prompt Helpers -----------------------------

def summarize_text_with_gemini(text: str, label: str) -> str:
    if not text.strip():
        return ""
    prompt = f"""
You are a concise summarizer.
Summarize the following {label} in simple bullet points. Avoid examples or repetition.
{text[:MAX_CHARS_PER_CONTEXT]}
"""
    return call_gemini(prompt)

def course_outline_to_text(outline: Union[dict, List[dict]]) -> str:
    if isinstance(outline, dict):
        return "\n".join([f"- {k}: {v}" for k, v in outline.items()])
    elif isinstance(outline, list):
        return "\n".join([f"- {item['module']}: {item['description']}" for item in outline])
    return str(outline)

def submodules_to_bullets(submodules: List[Dict[str, str]]) -> str:
    return "\n".join([f"- {item['submoduleName']}: {item['submoduleDescription']}" for item in submodules])

# ----------------------------- Pydantic Models -----------------------------

class ReadingInput(BaseModel):
    course_outline: Union[dict, List[dict]]
    module_name: str
    submodule_name: str
    activity_id: str  
    activity_name: str
    activity_description: str
    activity_objective: str
    user_prompt: str
    previous_material_summary: str
    notes_path: Optional[str] = None
    pdf_path: Optional[str] = None
    url: Optional[str] = None

class LectureInput(BaseModel):
    course_outline: Union[dict, List[dict]]
    module_name: str
    submodule_name: str
    activity_id: str
    activity_name: str
    activity_description: str
    activity_objective: str
    user_prompt: str
    prev_activities_summary: Union[str, None] = None
    notes_path: Union[str, None] = None
    pdf_path: Union[str, None] = None
    text_examples: Union[List[str], None] = None
    duration_minutes: Union[int, None] = 10

class QuizInput(BaseModel):
    module_name: str
    submodule_name: str
    activity_id: str
    activity_name: str
    activity_description: str
    activity_objective: str
    material_summary: str  # Lecture script or reading material summary of this submodule
    number_of_questions: int
    quiz_type: str  # "MCQ" or "T/F"
    total_score: int
    user_prompt: str

class AssignmentInput(BaseModel):
    module_name: str
    submodule_name: str
    user_prompt: str
    all_submodule_summaries: List[Dict[str, str]]

class MindmapInput(BaseModel):
    module_name: str
    submodule_summaries: List[Dict[str, str]]


class QuizOut(BaseModel):
    question_id: str
    question: str
    options: Union[List[str], None] = None  # For MCQs
    answer: str
    explanation: str

class QuizSet(BaseModel):
    module_name: str
    submodule_name: str
    questions: List[QuizOut]

class ReadingMaterialOut(BaseModel):
    reading_material: str
    reading_material_summary: str
    source_summaries: Optional[List[str]] = None

class LectureScriptOut(BaseModel):
    lecture_script: str
    source_summaries: Optional[List[str]] = None
    lecture_script_summary: Optional[str] = None
# ----------------------------- Content Generators -----------------------------

def generate_reading_material(
    course_outline,
    module_name,
    submodule_name,
    activity_name,
    activity_description,
    activity_objective,
    user_prompt,
    previous_material_summary,
    notes_path=None,
    pdf_path=None,
    url=None
):
    notes_text = clean_text(read_file(notes_path)) if notes_path else ""
    pdf_text = clean_text(extract_text_from_pdf(pdf_path)) if pdf_path else ""
    url_text = clean_text(scrape_text_from_url(url)) if url else ""

    summarized_notes = summarize_text_with_gemini(notes_text, label="lecture notes") if notes_text else ""
    summarized_pdf = summarize_text_with_gemini(pdf_text, label="PDF reading") if pdf_text else ""
    summarized_url = summarize_text_with_gemini(url_text, label="web article") if url_text else ""

    combined_context = "\n\n".join(filter(None, [
        f"--- Summary from Notes ---\n{summarized_notes}",
        f"--- Summary from PDF ---\n{summarized_pdf}",
        f"--- Summary from URL ---\n{summarized_url}"
    ])).strip()

    combined_context = truncate_text(combined_context)

    prompt = f"""
You are an expert Math/Data Analyst/Machine Learning/Deep Learning/Generative AI educator.

Create **reading material** for a submodule. Ensure:
- Alignment with course outline
- Avoid redundancy with previous materials
- Friendly tone, examples, code snippets, and illustrations
- Clear connection to course progression

### Input:
Course Outline:
{course_outline_to_text(course_outline)}

Module: {module_name}
Submodule: {submodule_name}
User Prompt: {user_prompt}
Activity Name: {activity_name}
Activity Description: {activity_description}
Activity Objective: {activity_objective}
Previous Summary: {previous_material_summary}
Context:
{combined_context or 'No additional context provided.'}

### INSTRUCTIONS:
- Use clear headings and subheadings
- Include explanations, examples, and code snippets
- Use math where relevant
- Suggest visuals (diagrams, charts) to enhance understanding
- Ensure the material is strictly relevant to specified activity (based on name, description, and objective)
- Avoid unnecessary repetition of previous material

### Output Format:
Return a JSON object with the following fields:
- reading_material: Markdown passage with clear structure, explanations, examples, code, math, applications, suggested visuals, and ending summary.
- source_summaries: A list of summaries for notes, PDF, and URL (omit if not available).
"""

    user_content = Content(
        role="user",
        parts=[
            Part(text="Generate reading material and summaries based on the following instructions:")
        ]
    )

    response = call_llm(user_content, prompt, ReadingMaterialOut)
    if response is None:
        return ReadingMaterialOut(
            reading_material="Nothing was generated. Please try again.",
            reading_material_summary="",
            source_summaries=None
        ), {
            "notesSummary": summarized_notes,
            "pdfSummary": summarized_pdf,
            "urlSummary": summarized_url
        }

    # Fallback summarization (auto-summarize if missing)
    material_summary = response.get("reading_material_summary")
    if not material_summary:
        summary_prompt = f"""
Summarize the following reading material in concise bullet points:
{response['reading_material']}
"""
        material_summary = call_gemini(summary_prompt) or ""

    return ReadingMaterialOut(
        reading_material=response["reading_material"],
        reading_material_summary=material_summary,
        source_summaries=response.get("source_summaries")
    ), {
        "notesSummary": summarized_notes,
        "pdfSummary": summarized_pdf,
        "urlSummary": summarized_url
    }


def generate_lecture_script(
    course_outline,
    module_name,
    submodule_name,
    activity_name,
    activity_description,
    activity_objective,
    user_prompt,
    prev_activities_summary=None,
    notes_path=None,
    pdf_path=None,
    text_examples: Optional[List[str]] = None,
    duration_minutes: int = 10
):
    notes_text = clean_text(extract_text_from_txt(notes_path)) if notes_path else ""
    pdf_text = clean_text(extract_text_from_pdf(pdf_path)) if pdf_path else ""
    examples_text = "\n".join(text_examples or [])

    summarized_notes = summarize_text_with_gemini(notes_text, label="lecture notes") if notes_text else ""
    summarized_pdf = summarize_text_with_gemini(pdf_text, label="PDF reference") if pdf_text else ""
    summarized_examples = summarize_text_with_gemini(examples_text, label="example explanations") if examples_text else ""

    combined_context = "\n\n".join([
        f"--- Notes Summary ---\n{summarized_notes}" if summarized_notes else "",
        f"--- PDF Summary ---\n{summarized_pdf}" if summarized_pdf else "",
        f"--- Example Summary ---\n{summarized_examples}" if summarized_examples else "",
        f"--- Previous Activities Summary ---\n{prev_activities_summary}" if prev_activities_summary else ""
    ]).strip()

    combined_context = truncate_text(combined_context)

    prompt = f"""
You are a skilled educator and video content designer.

Create a **lecture script** for the following submodule of an AI course.

- The tone should match the user's prompt
- Include key explanations and smooth transitions
- Make it suitable for a {duration_minutes}-minute video
- The content should strictly adhere to the duration and activity objective
- Use examples and engaging analogies when possible
- **MAKE SURE THE TIMESTAMPS ARE PROPERLY ALIGNED WITH THE CONTENT**

### Input:

Course Outline:
{course_outline_to_text(course_outline)}

Module: {module_name}
Submodule: {submodule_name}
Activity Name: {activity_name}
Activity Description: {activity_description}
Activity Objective: {activity_objective}
User Prompt: {user_prompt}
Duration: {duration_minutes} minutes

### Context:
{combined_context or 'No prior material provided.'}

### INSTRUCTIONS:
- Suggest visuals (diagrams, charts) to enhance understanding
- Ensure the script is strictly relevant to specified activity (based on name, description, and objective)
- Avoid unnecessary repetition of previous script material

### Output:
Return a JSON object with the following fields:
- lecture_script: The full lecture script in markdown format, with proper headings, speaker notes, and segments.
- source_summaries: A list of summaries for notes, PDF, and examples (omit if not available).
- lecture_script_summary: A concise summary of the lecture script (see below).


Return in bullet points, grouped under "Key Concepts", "Learning Goals", and "Examples or Analogies".
"""

    user_content = Content(
        role="user",
        parts=[
            Part(text="Generate a lecture script and summary based on the following instructions:"),
        ]
    )

    response = call_llm(user_content, prompt, LectureScriptOut, temp=0.4)
    if response is None:
        return {"error": "Nothing was generated. Please try again."}, {
            "notesSummary": summarized_notes,
            "pdfSummary": summarized_pdf,
            "examplesSummary": summarized_examples
        }, None

    lecture_script = response["lecture_script"]

    # ✅ Auto-generate summary if not provided by LLM
    summary_prompt = f"""
Summarize the following lecture script in bullet points grouped by:

- Key Concepts
- Learning Goals
- Examples or Analogies

Lecture Script:
{lecture_script}
"""
    lecture_script_summary = call_gemini(summary_prompt) or ""

    return (
        lecture_script,
        {
            "notesSummary": summarized_notes,
            "pdfSummary": summarized_pdf,
            "examplesSummary": summarized_examples
        },
        lecture_script_summary
    )


def generate_quiz(module_name: str,
                 submodule_name: str,
                 activity_name: str,
                 activity_description: str,
                 activity_objective: str,
                 material_summary: str,
                 number_of_questions: int,
                 quiz_type: str,
                 total_score: int,
                 user_prompt: str) -> Optional[Dict]:

    prompt = f"""
You are a quiz designer for an educational AI system.

### Task:
Generate a quiz for the **submodule** "{submodule_name}" under the module "{module_name}, having activity name {activity_name} which is all about {activity_description} to achieve the objective of {activity_objective}". Use the following content source:

### Material Summary:
{material_summary}

### Guidelines:
- Create exactly {number_of_questions} questions.
- Quiz Type: {quiz_type}
- Total Score: {total_score} (distribute marks equally).
- Follow this user instruction: {user_prompt}
- Each question must include a short explanation of the correct answer.
- Questions should be beginner-friendly and test conceptual clarity.
- Ensure the questions are relevant to the submodule content and activity objective.

### Output Format:
Return a **JSON array** where each item follows this schema:
{{
  "question_id": "<unique_id>",  # e.g. "Q1", "Q2", etc.
  "question": "<question_text>",
  "options": ["<A>", "<B>", "<C>", "<D>"],  # Omit if T/F
  "answer": "<correct_option>",  # "A", "B", "C", "D" or "True"/"False"
  "explanation": "<why this is the correct answer>"
}}

### Rules:
- For **MCQ**, provide exactly 4 options and one correct answer.
- For **T/F**, avoid ambiguity and give direct true/false questions.
- Only return the JSON array. No markdown or comments.
"""
    user_content=Content(
        role="user",
        parts=[
            Part(text="Generate a quiz based on the following instructions:"),
        ]
    )
    response = call_llm(user_content, prompt, QuizSet)
    return response if response is not None else {"error": "Nothing was generated. Please try again."}


def generate_assignment(module_name, submodule_name, user_prompt, all_submodule_summaries):
    prompt = f"""
You are a course designer. Create an **assignment** based on submodule summaries.
It should integrate concepts and assess practical + theoretical understanding.

### Input:
Module: {module_name}
Submodule: {submodule_name}
User Prompt: {user_prompt}
Submodule Summaries:
{submodules_to_bullets(all_submodule_summaries)}

### Output:
Markdown with Title, Description, Objectives, Deliverables, Evaluation Criteria
"""
    return call_gemini(prompt)

def generate_mindmap(module_name, submodule_summaries):
    prompt = f"""
You are a mind map generator.
Create a **mind map** from submodule summaries in nested bullet point style.

### Input:
Module: {module_name}
Summaries:
{submodules_to_bullets(submodule_summaries)}

### Output:
Markdown nested bullet point map
"""
    return call_gemini(prompt)