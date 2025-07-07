from fastapi import APIRouter, HTTPException
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
from validator import (    
    validate_content_with_keywords,
    summarize_validation_report,
    ValidationResult,
    ValidationSummary,
    ValidateContentInput,
    ValidateContentOut
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

class RedoRequest(BaseModel):
    stage: Stage
    prev_content: Dict[str, Any]
    user_message: str

class ValidateRequest(BaseModel):
    content: str
    activity_name: str
    content_type: str  

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
        "audience_type": audience.demographic,
        "audience_board": audience.board,
        "audience_specialization": audience.specialization,
        "audience_country": audience.country
    })

    input_record = {
        "version_id": version_id,
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

    # Step 4: Store the outline
    outline_record = {
        "version_id": version_id,
        "course_id": course_id,
        "outline": result,
        "timestamp": datetime.now(timezone.utc)
    }

    try:
        collection_outline.insert_one(outline_record)
        logger.info(f"Stored course outline for course_id={course_id}")
    except Exception as e:
        logger.exception("Failed to store course outline in MongoDB")

    # Step 5: Save in in-memory state
    course_state[course_id] = {
        "course_init": course_dict,
        "outline": result
    }

    # Step 6: Get suggestions for next stage
    suggestions = get_stage_suggestions(Stage.outline, as_json(result))

    # Final Response
    return {
        "result": result,
        "suggestions": suggestions,
        "version_id": version_id,
        "course_id": course_id
    }


@router.post("/generate/modules")
def generate_module(course_outline: CourseOutline):
    logger.info("Generating modules...")

    version_id = str(uuid.uuid4())  # Track version

    # Step 1: Generate raw result
    result_str = generate_modules(course_outline)
    if isinstance(result_str, dict):
        result_str = json.dumps(result_str)

    # Step 2: Validate and parse
    result = parse_result(result_str, ModuleSet)

    # Step 3: Generate UUIDs for each module_id
    for module in result.modules:
        module.module_id = str(uuid.uuid4())
    module_ids = [m.module_id for m in result.modules]
    auto_tag_version(course_outline.course_id, version_id, Stage.module, "initial-module")
    # Step 4: Store in MongoDB (collection_modules)
    module_record = {
        "course_id": course_outline.course_id,
        "version_id": version_id,
        "module_ids": module_ids,
        "stage": "module",
        "generated_modules": result.model_dump(),
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

    # Step 6: Get suggestions and return
    suggestions = get_stage_suggestions(Stage.module, as_json(result))
    return {
        "result": result,
        "suggestions": suggestions,
        "version_id": version_id,
        "course_id": course_outline.course_id
    }

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
    submodule_record = {
        "module_id": module.module_id,
        "version_id": version_id,
        "generated_submodules": result.model_dump(),
        "submodule_ids": submodule_ids,
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
    suggestions = get_stage_suggestions(Stage.submodule, as_json(result))
    return {
        "result": result,
        "suggestions": suggestions,
        "version_id": version_id,
        "module_id": module.module_id
    }

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
        "generated_activities": result.model_dump(),
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



@router.post("/validate-content", response_model=ValidateContentOut)
def api_validate_content(input: ValidateContentInput):
    try:
        detailed_report = validate_content_with_keywords(
            content=input.content,
            activity_name=input.activity_name,
            activity_type=input.activity_type
        )
        validation_results = [
            ValidationResult.model_validate(item) if not isinstance(item, ValidationResult) else item
            for item in detailed_report
        ]
        summary = summarize_validation_report(validation_results)

        return {
            "summary": summary,
            "detailedReport": detailed_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
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
