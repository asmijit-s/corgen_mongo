from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ValidationError
from typing import List, Optional, Dict, TypeVar, Type
from pymongo import MongoClient
import uuid
from datetime import datetime, timezone

from genai_logic import (
    CourseInit,
    CourseOutline,
    ModuleSet,
    Module,
    SubmoduleSet,
    Submodule,
    ActivitySet,
    generate_course_outline,
    generate_modules,
    generate_submodules,
    generate_activities,
    get_stage_suggestions,
    redo_stage,
    Stage
)
from course_content_generator import (
    generate_reading_material,
    generate_lecture_script,
    generate_quiz,
    generate_assignment,
    generate_mindmap,
    ReadingInput,
    LectureInput,
    QuizInput,
    AssignmentInput,
    MindmapInput,
    QuizOut,
    ReadingMaterialOut,
    LectureScriptOut
)
                  
import json
import logging
from typing import Optional, Dict, Any
from fastapi.responses import JSONResponse

router = APIRouter()

# Configure logging
logger = logging.getLogger("course_api")
logging.basicConfig(level=logging.INFO)


MONGO_URI = "mongodb+srv://asmijits:w8XmSk1mRjP5RI46@cluster0.hv0xmmi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "corgen"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection_input = db["course"]
collection_outline= db["outline"]
collection_modules = db["modules"]
collection_submodules = db["submodules"]
collection_activities = db["activities"]
collection_content= db["content"] 
collection_latest_versions = db["latest_versions"]
collection_version_tags = db["version_tags"]
# In-memory course state for tracking previous stages
course_state = {}

class ActivityRequest(BaseModel):
    submodule_id :str
    submodule_name :str
    submodule_description: str
    activity_types: List[str]
    user_instructions: Optional[str] = None
    parent_version_id: Optional[str] = None

class RedoRequest(BaseModel):
    stage: Stage
    prev_content: Dict[str, Any]
    user_message: str

class ValidateRequest(BaseModel):
    content: str
    activity_name: str
    content_type: str  

class BranchRequest(BaseModel):
    version_id: str
    stage: Stage

class VersionHistoryResponse(BaseModel):
    version_id: str
    parent_version_id: Optional[str]
    timestamp: datetime
    stage: Stage
    tag: Optional[str]

class OutlineUpdate(BaseModel):
    course_id: str
    version_id: str
    updates: dict  # key-value pairs of fields to update

class UpdateModulePayload(BaseModel):
    course_id: str
    version_id: str
    module_id: str
    updated_fields: Dict[str, Any]

class UpdateSubmodulePayload(BaseModel):
    module_id: str
    version_id: str
    submodule_id: str
    updated_fields: Dict[str, Any]

class AddModule(BaseModel):
    course_id: str
    version_id: str
    module: Module

class AddSubmodulePayload(BaseModel):
    module_id: str
    version_id: str
    submodule : Submodule
    
def as_json(obj: BaseModel | dict) -> str:
    return json.dumps(obj.model_dump() if isinstance(obj, BaseModel) else obj, indent=2)

T = TypeVar("T", bound=BaseModel)

def parse_result(result_str: str | None, model: type[T]) -> T:
    if not result_str:
        logger.error("LLM returned no result.")
        raise HTTPException(status_code=500, detail="No result returned from LLM")
    try:
        raw_data = json.loads(result_str)
        validated = model.model_validate(raw_data)
        return validated
    except json.JSONDecodeError as e:
        logger.exception("Failed to parse LLM result as JSON.")
        raise HTTPException(status_code=500, detail="Invalid result format from LLM")
    except ValidationError as ve:
        logger.exception("Parsed result failed schema validation.")
        raise HTTPException(status_code=500, detail=f"Schema validation failed: {ve.errors()}")

def auto_tag_version(entity_id: str, version_id: str, stage: Stage, prefix: str):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    tag = f"{prefix}-{timestamp}"

    try:
        collection_version_tags.insert_one({
            "entity_id": entity_id,
            "stage": stage.value,
            "tag": tag,
            "version_id": version_id,
            "timestamp": datetime.now(timezone.utc)
        })
        logger.info(f"Auto-tagged version {version_id} as '{tag}'")
    except Exception as e:
        logger.warning(f"Auto-tagging failed for {version_id}: {e}")

def safe_bson(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="python")
    return obj

@router.post("/generate/outline")
def generate_outline(course: CourseInit):
    logger.info("Generating course outline...")

    # Step 1: Generate IDs
    version_id = str(uuid.uuid4())
    course_id = str(uuid.uuid4())
    course.course_id = course_id  # Attach to model
    auto_tag_version(course_id, version_id, Stage.outline, "initial-outline")

    # Step 2: Dump course input (with nested fields) for storage
    course_dict = course.model_dump(mode="python")

    # Optional: Flatten audience fields for filtering in MongoDB
    audience = course.target_audience
    course_dict.update({
        "audience_type": audience.audienceType,
        "audience_grade": audience.grade,
        "audience_english_level": audience.english_level,
        "audience_math_level": audience.maths_level,
        "audience_specialization": audience.specialization,
        "audience_country": audience.country
    })

    input_record = {
        "course_id": course_id,
        "user_input": course_dict,
        "stage": "init",
        "timestamp": datetime.now(timezone.utc)
    }

    try:
        collection_input.insert_one(input_record)
        logger.info(f"Stored input for course_id={course_id} with version_id={version_id}")
    except Exception as e:
        logger.exception("Failed to store course input in MongoDB")

    # Step 3: Generate the outline from the LLM
    result_data = generate_course_outline(course)

    if result_data is None or not isinstance(result_data, dict):
        return {"error": "Failed to generate outline. Please try again."}

    try:
        result_str = json.dumps(result_data)
        result = parse_result(result_str, CourseOutline)
    except Exception as e:
        logger.exception("Failed to parse LLM response into CourseOutline")
        return {"error": "LLM response could not be parsed."}

    course_state[course_id] = {
        "course_init": course_dict,
        "outline": result
    }
    suggestions = get_stage_suggestions(Stage.outline, as_json(result))

    # Step 4: Store the outline
    outline_record = {
        "version_id": version_id,
        "course_id": course_id,
        "outline": safe_bson(result),
        "suggestions_outlines": suggestions,
        "timestamp": datetime.now(timezone.utc)
    }

    try:
        collection_outline.insert_one(outline_record)
        logger.info(f"Stored course outline for course_id={course_id}")
    except Exception as e:
        logger.exception("Failed to store course outline in MongoDB")

    

    # Final Response
    return {
        "result": result,
        "suggestions": suggestions,
        "version_id": version_id,
        "course_id": course_id
    }

@router.get("/get_outline")
def get_course_outline(course_id: Optional[str] = None, version_id: Optional[str] = None):
    print(f'course_id: {type(course_id)}-{course_id}')
    print(f'version_id: {type(version_id)}-{version_id}')
    result = collection_outline.find_one({"course_id": course_id, "version_id": version_id})
    if not result:
        raise HTTPException(status_code=404, detail="Course outline not found")
    
    result["_id"] = str(result["_id"])  # Convert ObjectId for frontend safety
    return result

@router.put("/outline/update")
def update_course_outline(update: OutlineUpdate):
    result = collection_outline.update_one(
        {"course_id": update.course_id, "version_id": update.version_id},
        {"$set": {f"outline.{k}": v for k, v in update.updates.items()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Outline not updated")
    return {"message": "Outline updated successfully"}

@router.post("/generate/modules")
def generate_module(course_outline: CourseOutline):
    logger.info("Generating modules...")

    version_id = str(uuid.uuid4())  # Track version

    result_str = generate_modules(course_outline)
    if isinstance(result_str, dict):
        result_str = json.dumps(result_str)

    result = parse_result(result_str, ModuleSet)

    for module in result.modules:
        module.module_id = str(uuid.uuid4())
    module_ids = [m.module_id for m in result.modules]
    auto_tag_version(course_outline.course_id, version_id, Stage.module, "initial-module")
    suggestions = get_stage_suggestions(Stage.module, as_json(result))
    module_record = {
        "course_id": course_outline.course_id,
        "version_id": version_id,
        "module_ids": module_ids,
        "stage": "module",
        "generated_modules": safe_bson(result),
        "suggestions_modules": suggestions,
        "timestamp": datetime.now(timezone.utc)
    }

    try:
        collection_modules.insert_one(module_record)
        logger.info(f"Stored modules for course_id={course_outline.course_id} with version_id={version_id}")
    except Exception as e:
        logger.exception("Failed to store modules in MongoDB")

    # Step 5: Update in-memory state
    course_entry = course_state.setdefault(course_outline.course_id, {})
    course_entry["modules"] = result

    return {
        "version_id": version_id,
        "course_id": course_outline.course_id
    }

@router.get("/get_modules")
def get_modules(course_id: Optional[str] = None, version_id: Optional[str] = None, module_id: Optional[str] = None):
    doc = collection_modules.find_one({"course_id": course_id, "version_id": version_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Modules not found")

    doc["_id"] = str(doc["_id"])
    modules = doc["generated_modules"]["modules"]

    if module_id:
        for module in modules:
            if module.get("module_id") == module_id:
                return {
                    "module": module,
                    "suggestions": doc.get("suggestions_modules", []),
                    "version_id": version_id,
                    "course_id": course_id
                }
        raise HTTPException(status_code=404, detail="Module not found for provided module_id")

    # If no module_id is provided, return all modules
    return {
        "modules": modules,
        "suggestions": doc.get("suggestions_modules", []),
        "version_id": version_id,
        "course_id": course_id
    }


@router.post("/module/add")
def add_module(payload: AddModule):
    result = collection_modules.update_one(
        {"course_id": payload.course_id, "version_id": payload.version_id},
        {"$push": {"generated_modules.modules": payload.module.dict()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Module not added")

    return {
        "message": "Module added successfully",
        "module": payload.module
    }

@router.put("/module/update")
def update_module(payload: UpdateModulePayload):
    result = collection_modules.update_one(
        {
            "course_id": payload.course_id,
            "version_id": payload.version_id,
            "generated_modules.modules.module_id": payload.module_id
        },
        {
            "$set": {
                f"generated_modules.modules.$.{k}": v for k, v in payload.updated_fields.items()
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Module not updated")
    return {"message": "Module updated", "module_id": payload.module_id}

@router.delete("/module/delete")
def delete_module(course_id: str, version_id: str, module_id: str):
    result = collection_modules.update_one(
        {"course_id": course_id, "version_id": version_id},
        {"$pull": {"generated_modules.modules": {"module_id": module_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Module not deleted")
    return {"message": "Module deleted", "module_id": module_id}

@router.post("/generate/submodules")
def generate_submodule(module: Module):
    logger.info("Generating submodules...")
    result_str = generate_submodules(module)
    if isinstance(result_str, dict):
        result_str = json.dumps(result_str)
    if not result_str:
        raise HTTPException(status_code=400, detail="Failed to generate submodules")

    version_id = str(uuid.uuid4())  # Track version
    
    result = parse_result(result_str, SubmoduleSet)

    submodule_ids= []
    for submodule in result.submodules:
        submodule.submodule_id = str(uuid.uuid4())
        submodule_ids.append(submodule.submodule_id)
    auto_tag_version(module.module_id, version_id, Stage.submodule, "initial-submodule")
    suggestions = get_stage_suggestions(Stage.submodule, as_json(result))

    submodule_record = {
        "module_id": module.module_id,
        "version_id": version_id,
        "generated_submodules": safe_bson(result),
        "submodule_ids": submodule_ids,
        "suggestions_submodules" : suggestions,
        "stage": "submodule",
        "timestamp": datetime.now(timezone.utc)
    }

    try:
        collection_submodules.insert_one(submodule_record)
        logger.info(f"Stored submodules for module_id={module.module_id} with version_id={version_id}")
    except Exception as e:
        logger.exception("Failed to store submodules in MongoDB")

    course_state[module.module_id] = course_state.get(module.module_id, {})
    course_state[module.module_id]["submodules"] = result
    return {
        "version_id": version_id,
        "module_id": module.module_id
    }

@router.get("/get_submodules")
def get_submodules(module_id: str, version_id: str, submodule_id: Optional[str] = None):
    record = collection_submodules.find_one({
        "module_id": module_id,
        "version_id": version_id
    })

    if not record:
        raise HTTPException(status_code=404, detail="Submodules not found")

    return {
        "submodules": record.get("generated_submodules", {}).get("submodules", []),
        "suggestions": record.get("suggestions_submodules", [])
    }

@router.put("/submodules/update")
def update_submodule(payload: UpdateSubmodulePayload):
    result = collection_submodules.update_one(
        {
            "module_id": payload.module_id,
            "version_id": payload.version_id,
            "generated_submodules.submodules.submodule_id": payload.submodule_id
        },
        {
            "$set": {
                f"generated_submodules.submodules.$.{k}": v for k, v in payload.updated_fields.items()
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Submodule not updated")
    return {"message": "Submodule updated", "submodule_id": payload.submodule_id}

@router.delete("/submodules/delete")
def delete_submodule(module_id: str, version_id: str, submodule_id: str):
    result = collection_submodules.update_one(
        {"module_id": module_id, "version_id": version_id},
        {"$pull": {"generated_submodules.submodules": {"submodule_id": submodule_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Submodule not deleted")
    return {"message": "Submodule deleted successfully"}

@router.post("/submodules/add")
def add_submodule(payload: AddSubmodulePayload):
    result = collection_submodules.update_one(
        {"module_id": payload.module_id, "version_id": payload.version_id},
        {"$push": {"generated_submodules.submodules": payload.submodule.dict()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Submodule not added")
    return {"message": "Submodule added successfully", "submodule": payload.submodule}

@router.post("/generate/activities")
def generate_activity(payload: ActivityRequest):
    logger.info("Generating activities...")
    submodule = Submodule(
        submodule_id=payload.submodule_id,
        submodule_title=payload.submodule_name,
        submodule_description=payload.submodule_description
    )
    result_str = generate_activities(
        submodule=submodule,
        activity_types=",".join(payload.activity_types),
        user_instructions=payload.user_instructions
    )
    if isinstance(result_str, dict):
        result_str = json.dumps(result_str)
    result = parse_result(result_str, ActivitySet)

    version_id = str(uuid.uuid4())  # Track version
    activity_ids = []
    for activity in result.activities:
        activity.activity_id = str(uuid.uuid4())
        activity_ids.append(activity.activity_id)
    auto_tag_version(payload.submodule_id, version_id, Stage.activity, "initial-activity")
    activity_record = {
        "submodule_id": payload.submodule_id,
        "version_id": version_id,
        "generated_activities": safe_bson(result),
        "activity_ids": activity_ids,
        "stage": "activity",
        "timestamp": datetime.now(timezone.utc)
    }

    try:
        collection_activities.insert_one(activity_record)
        logger.info(f"Stored activities for submodule_id={payload.submodule_id} with version_id={version_id}")
    except Exception as e:
        logger.exception("Failed to store activities in MongoDB")

    course_state[payload.submodule_id] = course_state.get(payload.submodule_id, {})
    course_state[payload.submodule_id]["activities"] = result
    suggestions = get_stage_suggestions(Stage.activity, as_json(result))
    return {
        "result": result,
        "suggestions": suggestions,
        "version_id": version_id,
        "submodule_id": payload.submodule_id
    }


@router.post("/generate-reading-material", response_model=ReadingMaterialOut)
def api_generate_reading(input: ReadingInput):
    try:
        # Step 1: Generate reading material
        result, _ = generate_reading_material(
            course_outline=input.course_outline,
            module_name=input.module_name,
            submodule_name=input.submodule_name,
            activity_name=input.activity_name,
            activity_description=input.activity_description,
            activity_objective=input.activity_objective,
            user_prompt=input.user_prompt,
            previous_material_summary=input.previous_material_summary,
            notes_path=input.notes_path,
            pdf_path=input.pdf_path,
            url=input.url
        )

        # Step 2: Assign a version ID
        version_id = str(uuid.uuid4())

        # Step 3: Prepare record for MongoDB
        reading_record = {
            "activity_name": input.activity_name,
            "activity_objective": input.activity_objective,
            "activity_description": input.activity_description,
            "activity_type": "Reading Material",
            "version_id": version_id,
            "activity_id": input.activity_id,
            "reading_material": result.model_dump(),
            "timestamp": datetime.now(timezone.utc),
            "stage": "reading"
        }

        auto_tag_version(input.activity_id, version_id, Stage.reading, "initial-reading")
        collection_content.insert_one(reading_record)

        logger.info(f"Stored reading material for activity: {input.activity_name} with version_id: {version_id}")

        # Step 5: Return generated reading
        return result

    except Exception as e:
        logger.exception("Failed to generate or store reading material")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/generate-lecture-script", response_model=LectureScriptOut)
def api_lecture(input: LectureInput):
    try:
        # Step 1: Generate script
        script, summaries, summary_text = generate_lecture_script(
            course_outline=input.course_outline,
            module_name=input.module_name,
            submodule_name=input.submodule_name,
            activity_name=input.activity_name,
            activity_description=input.activity_description,
            activity_objective=input.activity_objective,
            user_prompt=input.user_prompt,
            prev_activities_summary=input.prev_activities_summary,
            notes_path=input.notes_path,
            pdf_path=input.pdf_path,
            text_examples=input.text_examples,
            duration_minutes=input.duration_minutes if input.duration_minutes is not None else 0
        )

        # Step 2: Prepare version ID
        version_id = str(uuid.uuid4())
        script_text = script.get("lecture_script") if isinstance(script, dict) else script or ""

        auto_tag_version(input.activity_id, version_id, Stage.lecture, "initial-lecture")
        lecture_record = {
            "activity_id": input.activity_id,
            "activity_name": input.activity_name,
            "activity_description": input.activity_description,
            "activity_objective": input.activity_objective,
            "activity_type": "Lecture",
            "version_id": version_id,
            "lecture_script": script_text,
            "source_summaries": summaries,
            "lecture_script_summary": summary_text,
            "stage": "lecture",
            "timestamp": datetime.now(timezone.utc),
        }

        # Step 4: Insert to Mongo
        collection_content.insert_one(lecture_record)
        logger.info(f"Stored lecture script for activity_id={input.activity_id} with version_id={version_id}")

        # Step 5: Return output
        return LectureScriptOut(
            lecture_script=script_text if script_text is not None else "",
            source_summaries=summaries if isinstance(summaries, list) else None,
            lecture_script_summary=summary_text
        )

    except Exception as e:
        logger.exception("Failed to generate or store lecture script")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-quiz", response_model=List[QuizOut])
def api_generate_quiz(input: QuizInput):
    try:
        # Step 1: Generate quiz
        quiz_response = generate_quiz(
            module_name=input.module_name,
            submodule_name=input.submodule_name,
            activity_name=input.activity_name,
            activity_description=input.activity_description,
            activity_objective=input.activity_objective,
            material_summary=input.material_summary,
            number_of_questions=input.number_of_questions,
            quiz_type=input.quiz_type,
            total_score=input.total_score,
            user_prompt=input.user_prompt
        )

        if isinstance(quiz_response, dict) and "error" in quiz_response:
            raise ValueError(quiz_response["error"])

        # Step 2: Extract questions and assign question IDs if needed
        quiz_list = quiz_response.get("questions") if isinstance(quiz_response, dict) else quiz_response
        if quiz_list is None:
            quiz_list = []
        for i, q in enumerate(quiz_list):
            if not q.get("question_id"):
                q["question_id"] = f"Q{i+1}"

        # Step 3: Assign version ID
        version_id = str(uuid.uuid4())

        auto_tag_version(input.activity_id, version_id, Stage.quiz, "initial-quiz")
        quiz_record = {
            "activity_name": input.activity_name,
            "activity_description": input.activity_description,
            "activity_objective": input.activity_objective,
            "activity_type": "Quiz",
            "version_id": version_id,
            "activity_id": input.activity_id,
            "quiz_type": input.quiz_type,
            "quiz_questions": quiz_list,
            "number_of_questions": input.number_of_questions,
            "total_score": input.total_score,
            "stage": "quiz",
            "timestamp": datetime.now(timezone.utc)
        }

        # Step 5: Store in MongoDB
        collection_content.insert_one(quiz_record)
        logger.info(f"Stored quiz for activity_id={input.activity_id} with version_id={version_id}")

        # Step 6: Return quiz list
        return [QuizOut(**q) for q in quiz_list]

    except Exception as e:
        logger.exception("Failed to generate or store quiz")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/redo")
def redo_any_stage(request: RedoRequest):
    logger.info(f"Redoing stage: {request.stage}")
    found_prev = request.prev_content

    # Step 1: Redo generation
    result_str = redo_stage(request.stage, prev_content=found_prev, user_message=request.user_message)
    if isinstance(result_str, dict):
        result_str = json.dumps(result_str)

    # Step 2: Schema mapping
    schema_map = {
        Stage.outline: CourseOutline,
        Stage.module: ModuleSet,
        Stage.submodule: SubmoduleSet,
        Stage.activity: ActivitySet,
        Stage.reading: ReadingMaterialOut,
        Stage.lecture: LectureScriptOut,
        Stage.quiz: QuizOut,
    }
    schema = schema_map.get(request.stage)
    if schema is None:
        raise HTTPException(status_code=400, detail=f"Unsupported stage: {request.stage}")

    # Step 3: Parse result and prepare versioning
    result = parse_result(result_str, schema)
    version_id = str(uuid.uuid4())
    previous_version_id = found_prev.get("version_id")
    timestamp = datetime.now(timezone.utc)

    identifier = (found_prev.get("course_id") or found_prev.get("module_id") or found_prev.get("submodule_id") or found_prev.get("activity_id"))
    if identifier is None:
        raise HTTPException(status_code=400, detail="No valid identifier found for version tagging")
    auto_tag_version(str(identifier), version_id, request.stage, f"redo-{request.stage.value}")
    try:
        record = {
            "version_id": version_id,
            "previous_version_id": previous_version_id,
            "timestamp": timestamp,
            "stage": request.stage.value
        }

        if request.stage == Stage.outline:
            record.update({
                "course_id": found_prev.get("course_id"),
                "generated_outline": result.model_dump(),
            })
            collection_outline.insert_one(record)

        elif request.stage == Stage.module:
            record.update({
                "course_id": found_prev.get("course_id"),
                "modules": result.model_dump().get("modules", []),
            })
            collection_modules.insert_one(record)

        elif request.stage == Stage.submodule:
            record.update({
                "module_id": found_prev.get("module_id"),
                "submodules": result.model_dump().get("submodules", []),
            })
            collection_submodules.insert_one(record)

        elif request.stage == Stage.activity:
            activity_ids = [str(uuid.uuid4()) for _ in result.activities]
            for i, a in enumerate(result.activities):
                a.activity_id = activity_ids[i]
            record.update({
                "submodule_id": found_prev.get("submodule_id"),
                "activities": result.model_dump().get("activities", []),
                "activity_ids": activity_ids,
            })
            collection_activities.insert_one(record)

        elif request.stage == Stage.reading:
            record.update({
                "activity_id": found_prev.get("activity_id"),
                "activity_name": found_prev.get("activity_name"),
                "activity_description": found_prev.get("activity_description"),
                "activity_objective": found_prev.get("activity_objective"),
                "activity_type": "Reading Material",
                "reading_material": result.model_dump(),
            })
            collection_content.insert_one(record)

        elif request.stage == Stage.lecture:
            record.update({
                "activity_id": found_prev.get("activity_id"),
                "activity_name": found_prev.get("activity_name"),
                "activity_description": found_prev.get("activity_description"),
                "activity_objective": found_prev.get("activity_objective"),
                "activity_type": "Lecture",
                "lecture_script": result.model_dump(),
            })
            collection_content.insert_one(record)

        elif request.stage == Stage.quiz:
            record.update({
                "activity_id": found_prev.get("activity_id"),
                "activity_name": found_prev.get("activity_name"),
                "activity_description": found_prev.get("activity_description"),
                "activity_objective": found_prev.get("activity_objective"),
                "activity_type": "Quiz",
                "quiz": result.model_dump(),
            })
            collection_content.insert_one(record)

        logger.info(f"Stored redo result for stage {request.stage} with version_id={version_id}")

    except Exception as e:
        logger.exception("Failed to store redo result in MongoDB")
        raise HTTPException(status_code=500, detail="Database storage failed during redo")

    # Step 5: Return updated result + suggestions
    suggestions = get_stage_suggestions(request.stage, as_json(result))

    return {
        "result": result,
        "suggestions": suggestions,
        "version_id": version_id,
        "previous_version_id": previous_version_id
    }

   
# Add this near the top with other Mongo collections
collection_latest_versions = db["latest_versions"]


@router.post("/rollback")
def rollback_version(stage: Stage, version_id: str):
    try:
        # Step 1: Identify the correct collection
        collection_map = {
            Stage.outline: collection_outline,
            Stage.module: collection_modules,
            Stage.submodule: collection_submodules,
            Stage.activity: collection_activities,
            Stage.reading: collection_content,
            Stage.lecture: collection_content,
            Stage.quiz: collection_content,
        }
        target_collection = collection_map.get(stage)
        if target_collection is None:
            raise HTTPException(status_code=400, detail="Unsupported stage for rollback")

        # Step 2: Fetch the target version
        old_version = target_collection.find_one({"version_id": version_id})
        if not old_version:
            raise HTTPException(status_code=404, detail="Version not found")

        # Step 3: Prepare a new version document
        new_version_id = str(uuid.uuid4())
        old_version["previous_version_id"] = version_id
        old_version["version_id"] = new_version_id
        old_version["timestamp"] = datetime.now(timezone.utc)
        old_version["copied_from_version_id"] = version_id
        del old_version["_id"]  # Let Mongo assign a new ID

        identifier = (
            old_version.get("course_id") or
            old_version.get("module_id") or
            old_version.get("submodule_id") or
            old_version.get("activity_id")
        )

        auto_tag_version(identifier, new_version_id, stage, f"rollback-{stage.value}")
        target_collection.insert_one(old_version)
        old_version["parent_version_id"] = version_id
        # Step 5: Update latest version pointer
        collection_latest_versions.update_one(
            {"entity_id": identifier, "stage": stage.value},
            {"$set": {"latest_version_id": new_version_id}},
            upsert=True
        )

        logger.info(f"Rollback complete: {stage.value} reverted to version {version_id} as new {new_version_id}")

        return {
            "message": f"Rollback successful. New version_id: {new_version_id}",
            "new_version_id": new_version_id
        }

    except Exception as e:
        logger.exception("Failed to rollback version")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/branch")
def branch_version(request: BranchRequest):
    logger.info(f"Branching from version: {request.version_id} at stage: {request.stage}")
    
    collection_map = {
        Stage.outline: collection_outline,
        Stage.module: collection_modules,
        Stage.submodule: collection_submodules,
        Stage.activity: collection_activities,
        Stage.reading: collection_content,
        Stage.lecture: collection_content,
        Stage.quiz: collection_content,
    }
    
    target_collection = collection_map.get(request.stage)
    if target_collection is None:
        raise HTTPException(status_code=400, detail="Unsupported stage for branching")
    
    # Find existing version
    existing_version = target_collection.find_one({"version_id": request.version_id})
    if not existing_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Create new branch
    new_version_id = str(uuid.uuid4())
    branch_data = dict(existing_version)
    branch_data["version_id"] = new_version_id
    branch_data["parent_version_id"] = request.version_id
    branch_data["timestamp"] = datetime.now(timezone.utc)
    
    # Remove MongoDB ID
    if "_id" in branch_data:
        del branch_data["_id"]
    
    # Insert new branch
    target_collection.insert_one(branch_data)
    
    # Auto-tag the new branch
    identifier = (
        branch_data.get("course_id") or 
        branch_data.get("module_id") or 
        branch_data.get("submodule_id") or 
        branch_data.get("activity_id")
    )
    if identifier is None:
        raise HTTPException(status_code=400, detail="No valid identifier found for version tagging")
    auto_tag_version(str(identifier), new_version_id, request.stage, "branch")
    
    return {
        "message": "Branch created successfully",
        "new_version_id": new_version_id,
        "parent_version_id": request.version_id,
        "stage": request.stage.value
    }

# Add version history endpoint
@router.get("/versions", response_model=List[VersionHistoryResponse])
def get_version_history(
    entity_id: str = Query(..., description="Course/Module/Submodule/Activity ID"),
    stage: Optional[Stage] = Query(None, description="Filter by stage")
):
    collections = []
    if stage:
        collections = [(stage, {
            Stage.outline: collection_outline,
            Stage.module: collection_modules,
            Stage.submodule: collection_submodules,
            Stage.activity: collection_activities,
            Stage.reading: collection_content,
            Stage.lecture: collection_content,
            Stage.quiz: collection_content,
        }.get(stage))]
    else:
        collections = [
            (Stage.outline, collection_outline),
            (Stage.module, collection_modules),
            (Stage.submodule, collection_submodules),
            (Stage.activity, collection_activities),
            (Stage.reading, collection_content),
            (Stage.lecture, collection_content),
            (Stage.quiz, collection_content),
        ]
    
    history = []
    for stg, coll in collections:
        if coll is None:
            continue
        # Find all versions for this entity
        cursor = coll.find({
            "$or": [
                {"course_id": entity_id},
                {"module_id": entity_id},
                {"submodule_id": entity_id},
                {"activity_id": entity_id}
            ]
        }, {"_id": 0, "version_id": 1, "parent_version_id": 1, "timestamp": 1})
        
        for doc in cursor:
            # Get tag if exists
            tag_doc = collection_version_tags.find_one({"version_id": doc["version_id"]})
            tag = tag_doc["tag"] if tag_doc else None
            
            history.append(VersionHistoryResponse(
                version_id=doc["version_id"],
                parent_version_id=doc.get("parent_version_id"),
                timestamp=doc["timestamp"],
                stage=stg,
                tag=tag
            ))
    
    # Sort by timestamp descending
    history.sort(key=lambda x: x.timestamp, reverse=True)
    
    return history
