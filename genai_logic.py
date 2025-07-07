import os
from google import genai
from google.genai import types
from google.genai.types import GenerateContentConfig, Content, Part
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Dict, Optional, Type
import json
import uuid
from pydantic import BaseModel
from course_content_generator import QuizOut, ReadingMaterialOut, LectureScriptOut
load_dotenv()

llmclient = genai.Client(api_key=os.getenv("GEMINI_API_KEY")) 

################## GENERIC LLM FUNCTIONS #######################################################
def call_llm(prompt: Content, system_prompt: str, response_schema: Type[BaseModel], debug: bool = False) -> Optional[dict]:
    try:
        response = llmclient.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.2
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

    
################################# SCHEMAS DICT ######################################################
SchemaDict = {}
SchemaDict["quiz"]=QuizOut
SchemaDict["reading"]=ReadingMaterialOut
SchemaDict["lecture"]=LectureScriptOut
################################# OUTLINE GENERATION ######################################################

class TargetAudience(BaseModel):
    demographic: str
    board: str
    specialization: str
    country: Optional[str] = None

class CourseInit(BaseModel):
    course_id: Optional[str] = None  # Optional, will be generated
    title: str
    prerequisites: List[str]
    description: str
    learning_objectives: List[str]
    target_audience: TargetAudience
    duration: str
    credits: float
    
class CourseOutline(BaseModel):
    course_id: str
    title: str
    prerequisites: List[str]
    description: str
    learning_outcomes: List[str]
    duration: str
    credits: float

SchemaDict["outline"]=CourseOutline

def generate_course_outline(course: CourseInit) -> Optional[dict]:
    #- Learning Objectives: {', '.join(course.learning_objectives)} removed this for now 
    prompt = f"""
You are a course design assistant helping Subject Matter Experts (SMEs) design high-quality academic courses. Based on the following inputs, generate a detailed course outline:

INPUTS:
- Title: {course.title}
- Prerequisites: {course.prerequisites}
- Description: {course.description}
- Learning Objective: {', '.join(course.learning_objectives)}
- Target Audience:
  - Learner Type: {course.target_audience.demographic}
  - Education Board: {course.target_audience.board}
  - Specialization: {course.target_audience.specialization}
  - Country: {course.target_audience.country}
- Duration: {course.duration}
- Credits: {course.credits}

Strictly return the output in the following format with clearly labeled sections:
- Course ID: {course.course_id}
- Title:
- Prerequisites:
- Description (Elaborate based on input):
- Learning OUTCOMES (Address skills gained by students, refer to instruction 1. Eg. 'Students will be able to...'):
- Total Duration:
- Total Credits

DEFINITIONS (NOT TO BE INCLUDED IN OUTPUT):
1) Title: Course title.
2) Description: It will contain information on what the course content will be, the broad topics and the focus. It will talk about the prerequisites to be fulfilled prior to enrolling in this course.
3) Learning Objectives: What the instructor intends to teach in the course.
4) Learning Outcomes: What the student will learn after completion of the course, i.e the skills obtained.
5) Target Audience: Demography of the target student.
6) Duration: Time duration (eg. 12 weeks)
7) Credits: Total course credits.

INSTRUCTIONS FOR GENERATION:
1) Translate the instructor-defined learning objectives into measurable, student-centered learning outcomes that reflect what the learner will be able to do by the end of the course.
2) Do not give breakdowns of credit or duration. Simply output the information given as input.
3) Ensure the description aligns with the learning objectives and outcomes. Avoid adding content not implied or supported by the inputs.
4) The learning outcomes and description should be appropriate and relevant to the target audience.
5) Strictly adhere to the output list format specified. The output should contain learning_outcomes NOT learning_objectives.
6) Customize the content based on the target audience:
   - For school students, use simplified concepts and age-appropriate vocabulary.
   - For undergraduates and postgraduates, use academically appropriate structure and discipline-specific terminology.
   - Consider the Education Board (e.g., CBSE, IB) to tailor rigor, format, or scope if relevant.
   - Incorporate specialization to keep the course relevant to the learner's domain (e.g., use computing-related examples for CS students).
7) Align learning outcomes with both the learner level and specialization.

Output must strictly match the JSON schema provided. 
Do NOT include additional fields like 'suggestions', 'notes', or 'explanations'.
Only return the raw structured object.

"""
    user_content = Content(
        role="user",
        parts=[
            Part(text="Generate a course outline."),
        ]
    )
    response = call_llm(prompt=user_content, system_prompt=prompt, response_schema=CourseOutline)
    return response if response is not None else {"error": "Nothing was generated. Please try again."}


############################### MODULE  GENERATION ######################################################
class Module(BaseModel):
    module_id: str
    module_title: str
    module_description: str
    module_hours: str

class ModuleSet(BaseModel):
    course_id: str
    modules: List[Module]

SchemaDict["module"] = ModuleSet

def generate_modules(course_outline: CourseOutline) -> Optional[dict]:
    system_prompt = """
You are a course design assistant helping Subject Matter Experts (SMEs) design high-quality academic courses.Based on the given course outline, generate a logical set of course modules that progressively build on each other.

### TASK:
- Decide how many modules are appropriate based on the course's duration, target audience, learning outcomes, and depth described.
- Ensure logical progression from introductory to advanced concepts.
- Balance content evenly across modules.
- Consider audience level and prerequisites.

### Each module should include:
- module_title: a clear, focused name
- module_description: detailed overview of content, learning goals, and practical skills
- module_hours: realistic duration (e.g., "6 hours", "10 hours")
- suggestions: optional teaching tips, activity ideas, or student challenges

### Output Format:
Return a JSON object with:
- course_id
- modules: list of module objects (title, description, module_hours, suggestions)

Output must strictly match the JSON schema provided. 
Do NOT include additional fields like 'suggestions', 'notes', or 'explanations'.
Only return the raw structured object.

"""

    user_content = Content(
        role="user",
        parts=[
            Part(text="Generate suitable course modules for this course."),
            Part(text=json.dumps(course_outline.model_dump(), indent=2))

        ]
    )

    response = call_llm(prompt=user_content, system_prompt=system_prompt, response_schema=ModuleSet)

    return response if response is not None else {"error": "Nothing was generated. Please try again."}

################################# SUBMODULE GENERATION ######################################################
class Submodule(BaseModel):
    submodule_id: str
    submodule_title: str
    submodule_description: str

class SubmoduleSet(BaseModel):
    module_id: str
    submodules: List[Submodule]

SchemaDict["submodule"] = SubmoduleSet

def generate_submodules(module: Module) -> Optional[dict]:
    system_prompt = """
    You are a course design assistant helping Subject Matter Experts (SMEs) design high-quality academic courses. Based on the provided module details, generate a set of submodules that break down the module into smaller, focused learning units.
    ### TASK:
    - Create submodules that logically progress from basic to advanced concepts.
    - Ensure each submodule covers a specific aspect of the module's content.
    - Each submodule should have a clear title and detailed description of the content, learning goals, and practical skills.

    ### Submodule Details:
    - Submodule Title: A clear, focused title for each submodule
    - Submodule Description: A detailed overview of the content, learning goals, and practical skills for each submodule

    Each submodule should be:
    - A logically scoped unit of learning under the module.
    - Clearly named.
    - Accompanied by a short beginner-friendly description (2-3 lines).
    - Proportional in quantity and depth to the module hours (i.e., more hours = more submodules or deeper concepts).

    ### Output Format:
    Return a JSON object with:
    - module_id: the ID of the parent module
    - submodules: list of submodule objects (submodule_title, submodule_description)

    Output must strictly match the JSON schema provided. 
Do NOT include additional fields like 'suggestions', 'notes', or 'explanations'.
Only return the raw structured object.

    """
    user_content=Content(
            role="user",
            parts=[
                Part(text="Module Info:\n" + json.dumps(module.model_dump(), indent=2)),
            ]
        )
    
    response = call_llm(
        prompt=user_content,
        system_prompt=system_prompt,
        response_schema=SubmoduleSet
    )

    return response if response is not None else {"error": "Nothing was generated. Please try again."}

################################# ACTIVITY GENERATION ######################################################
class Activity(BaseModel):
    activity_id: str 
    activity_name: str
    activity_description: str
    activity_objective: str
    activity_type: str

class ActivitySet(BaseModel):
    activities: List[Activity]

SchemaDict["activity"] = ActivitySet

def generate_activities(submodule: Submodule, activity_types: str, user_instructions: Optional[str] = None) -> Optional[dict]:
    system_prompt = f"""
You are a course design assistant helping Subject Matter Experts (SMEs) design high-quality academic courses.

Your task is to generate a list of learning activities for a course submodule. The user will provide the submodule name, description, and optionally a set of instructions and preferred activity types (like Lecture, Quiz, Assessment, etc.).

### Input:
- Submodule ID: {submodule.submodule_id}
- Submodule Name: {submodule.submodule_title}
- Submodule Description: {submodule.submodule_description}
- Preferred Activity Types: {activity_types}
- User Instructions (optional): {user_instructions or "None provided"}

### If no user instructions are provided, follow these general guidelines:
- Make activities clear, beginner-friendly, and well-aligned with the submodule's goal.
- Cover a mix of conceptual understanding and applied thinking.
- Ensure activities are engaging and useful for learners.
- Avoid duplication across types.
- There can be multiple activities of single type so as to best align with submodule's goal.

### Output Format:
Return the result strictly as a **JSON array** of activity objects. Each object should include:
- "activity_name": Title of the activity
- "activity_description": A short paragraph describing what the activity is
- "activity_objective": A specific learning objective or outcome for the activity
- "activity_type": One of the types provided (Lecture, Quiz, Assessment, Reading Material, Lab)

Now, generate the activity list based on the inputs provided.

Output must strictly match the JSON schema provided. 
Do NOT include additional fields like 'suggestions', 'notes', or 'explanations'.
Only return the raw structured object.

"""
    user_content = Content(
        role="user",
        parts=[
            Part(text="Generate activities based on the provided inputs.")
        ]
    )

    response = call_llm(
        prompt=user_content,
        system_prompt=system_prompt,
        response_schema=ActivitySet
    )

    return response if response is not None else {"error": "Nothing was generated. Please try again."}
########################################## STAGE SUGGESTIONS ########################################################
class SuggestionOutput(BaseModel):
    suggestions: List[str]
    # message: str

from enum import Enum

class Stage(str, Enum):
    outline = "outline"
    module = "module"
    submodule = "submodule"
    activity = "activity"
    reading = "reading"
    lecture = "lecture"
    quiz = "quiz"


def get_stage_suggestions(stage: Stage, context: str, feedback_mode: str = "light") -> Optional[dict]:
    prompt = f"""
You are a course design assistant supporting Subject Matter Experts (SMEs) in developing high-quality academic courses.

The course development process includes these stages:
1. **Outline Generation**: Define title, prerequisites, description, learning outcomes, duration, and credits.
2. **Module Creation**: Organize the course into logical, topic-based modules.
3. **Submodule Creation**: Break each module into focused, progressive submodules.
4. **Activity Design**: Add learning activities (lectures, quizzes, readings, assignments, labs) under each submodule.

You are reviewing the course at the **'{stage}'** stage.

Analyze the provided context and return {"concise" if feedback_mode == "light" else "detailed"} suggestions to improve, expand, or refine the content at this stage. Identify any missing or unclear elements and recommend enhancements.

STAGE INSTRUCTIONS:
- "outline": Improve clarity, ensure prerequisites are complete, align objectives and outcomes, and check description coherence.
- "module": Ensure logical topic grouping, full coverage of outcomes, and balanced workload.
- "submodule": Check for logical progression, appropriate granularity, and coverage of all module elements.
- "activity": Suggest varied pedagogical techniques, align with Bloom's taxonomy, and promote student engagement.
- "lecture": Enhance examples, clarify explanations, align with learning outcomes, and adjust methodology or duration as needed for coherence.
- "reading": Ensure material is engaging, relevant, and appropriately challenging; include diverse sources and formats.
- "quiz": Design quizzes that assess understanding, align with objectives, and include varied question types and difficulty.

Current Context:
{context}

Carefully follow the stage instructions and provide actionable, stage-appropriate suggestions.
"""

    try:
        response = llmclient.models.generate_content(
            model="gemini-2.5-flash",
            contents=[Content(role="user", parts=[Part(text=context)])],
            config=GenerateContentConfig(
                system_instruction=prompt,
                response_mime_type='application/json',
                response_schema=SuggestionOutput
            )
        )
        return json.loads(response.text) if response.text else {}
    except Exception as e:
        return {"error": str(e)}
    

############################ REDO UNIFIED ########################################################

def redo_stage(stage: Stage, prev_content: dict, user_message: str) -> Optional[dict]:

    if stage not in SchemaDict:
        return {"error": f"No schema found for stage '{stage}'."}

    prompt = f"""
You are a course design assistant helping Subject Matter Experts (SMEs) design high-quality academic courses. You are provided with the previously generated content for a specific course development stage (**{stage}**).

The user has now submitted a suggestion to improve or modify this stage. Your task is to carefully update the content according to the user's feedback, while preserving useful and relevant information from the existing content.

Stage: {stage}
Existing Content:
{prev_content}

User Suggestion:
{user_message}

Instructions:
- Carefully analyze the user's suggestion and apply the requested changes to the stage content.
- Revise, add, or remove items as needed, but do not discard valuable content unless the suggestion explicitly mentions it.
- Ensure that the updated content remains coherent and relevant to the course development process.
- Maintain the structure and schema of the existing content.
- Do not discard any existing content unless explicitly requested by the user.
- If the user suggests adding new items, ensure they fit logically within the existing structure.
- If the stage contains items with IDs (e.g., module_id, submodule_id), ensure modifications are applied to the correct items.
- Maintain the expected structure and schema for this stage.
- Do not include extra explanations, notes, or suggestions in your output.
- The output should contain information that was present in the previous content, but updated according to the user's suggestion.

Output Requirements:
- Output must strictly match the JSON schema for the '{stage}' stage.
- Do NOT include additional fields or explanations.
- Only return the raw structured object.
"""
    user_content = Content(
        role="user",
        parts=[
            Part(text="Redo the content based on the user's suggestion."),
            Part(text=json.dumps(prev_content, indent=2)),
            Part(text="User Message: " + user_message)
        ]
    )

    response = call_llm(
        prompt=user_content,
        system_prompt=prompt,
        response_schema=SchemaDict[stage]
    )

    return response if response is not None else {"error": "Nothing was generated. Please try again."}