import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const GenerateQuiz = () => {
  const { moduleIdx, submoduleIdx, activityIdx } = useParams();
  const navigate = useNavigate();
  const [hasExistingQuiz, setHasExistingQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    instructions: '',
    quizType: 'mcq',
    grade: '',
    numberOfQuestions: 1
  });

  useEffect(() => {
    const checkForExistingQuiz = () => {
      try {
        const courseData = JSON.parse(localStorage.getItem('generatedCourse'));
        const quizContent = courseData?.modules?.[moduleIdx]?.submodules?.[submoduleIdx]?.activities?.[activityIdx]?.content;
        
        if (quizContent?.questions?.length > 0) {
          setHasExistingQuiz(true);
          navigate(`/quiz_editor/${moduleIdx}/${submoduleIdx}/${activityIdx}`);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error checking for existing quiz:', error);
        setLoading(false);
      }
    };

    checkForExistingQuiz();
  }, [moduleIdx, submoduleIdx, activityIdx, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  try {
    const courseData = JSON.parse(localStorage.getItem('generatedCourse'));
    const module = courseData?.modules?.[moduleIdx];
    const submodule = module?.submodules?.[submoduleIdx];
    const activity = submodule?.activities?.[activityIdx];

    if (!module || !submodule || !activity) {
      alert("Activity not found");
      return;
    }

    const payload = {
      course_outline: courseData.courseOutline || {},
      module_name: module.module_title || module.moduleName,
      submodule_name: submodule.submodule_title || submodule.submoduleName,
      material_summary: "", // optional, for now
      number_of_questions: parseInt(form.numberOfQuestions),
      quiz_type: form.quizType,
      total_score: parseInt(form.numberOfQuestions), // 1 mark per question by default
      user_prompt: form.instructions || ""
    };

    const response = await fetch('http://localhost:8000/course/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate quiz');
    }

    const data = await response.json(); // expects a JSON array of questions

    const formattedQuestions = data.map((q) => {
      let correctIndex = -1;

      // If answer is like "A", "B", "C", convert to index
      if (typeof q.answer === "string") {
        correctIndex = "ABCD".indexOf(q.answer.trim().toUpperCase());
      } else {
        correctIndex = parseInt(q.answer); // assume already index
      }

      return {
        id: uuidv4(),
        quizQuestion: q.question,
        options: q.options?.map((text, idx) => ({
          id: uuidv4(),
          text,
          isCorrect: idx === correctIndex,
        })) || [], // empty for T/F
        answerExplanation: q.explanation || "",
      };
    });

    activity.content = {
      instructions: form.instructions,
      grade: form.grade,
      quizType: form.quizType,
      questions: formattedQuestions
    };

    localStorage.setItem('generatedCourse', JSON.stringify(courseData));
    navigate(`/quiz_editor/${moduleIdx}/${submoduleIdx}/${activityIdx}`);
  } catch (error) {
    console.error('Error generating quiz:', error);
    alert(error.message || 'Failed to generate quiz.');
  } finally {
    setIsSubmitting(false);
  }
};


  if (loading) {
    return <div className="quiz-loading">Checking for existing quiz...</div>;
  }

  if (hasExistingQuiz) {
    return null; // Already navigating to QuizEditor
  }

  return (
    <div className="quiz-generator-container">
      <div className="quiz-generator-card">
        <h2 className="quiz-generator-title">Create New Quiz</h2>
        <p className="quiz-generator-subtitle">Configure your quiz settings</p>
        
        <form onSubmit={handleSubmit} className="quiz-generator-form">

          <div className="form-group">
            <label className="form-label">Instructions</label>
            <textarea
              name="instructions"
              value={form.instructions}
              onChange={handleChange}
              placeholder="Provide instructions for students"
              required
              rows={3}
              className="form-textarea"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quiz Type</label>
              <select 
                name="quizType" 
                value={form.quizType} 
                onChange={handleChange} 
                required
                className="form-select"
              >
                <option value="mcq">Multiple Choice</option>
                <option value="truefalse">True / False</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Total Marks</label>
              <input
                name="grade"
                value={form.grade}
                onChange={handleChange}
                placeholder="Total marks for Quiz"
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Number of Questions</label>
            <div className="number-input-container">
              <input
                type="number"
                name="numberOfQuestions"
                value={form.numberOfQuestions}
                onChange={handleChange}
                min="1"
                max="20"
                required
                className="form-input number-input"
              />
              <span className="input-hint">(1-20)</span>
            </div>
          </div>

          <button type="submit" className="generate-button" disabled={isSubmitting}>
            {isSubmitting ? 'Generating...' : 'Generate Quiz'}
            <svg className="button-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
      </div>

      <style jsx>{`
        .quiz-generator-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: calc(100vh - 80px);
          padding: 20px;
          background-color: #f8fafc;
        }
        
        .quiz-loading {
          text-align: center;
          padding: 40px;
          font-size: 18px;
          color: #64748b;
        }
        
        .quiz-generator-card {
          width: 100%;
          max-width: 640px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding: 32px;
          margin: 20px 0;
        }
        
        .quiz-generator-title {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 8px;
          text-align: center;
        }
        
        .quiz-generator-subtitle {
          font-size: 16px;
          color: #64748b;
          text-align: center;
          margin-bottom: 32px;
        }
        
        .quiz-generator-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .form-row {
          display: flex;
          gap: 20px;
        }
        
        .form-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .form-label {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }
        
        .form-input, .form-select, .form-textarea {
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          transition: all 0.2s;
          background-color: #f8fafc;
        }
        
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
          background-color: white;
        }
        
        .form-textarea {
          min-height: 100px;
          resize: vertical;
        }
        
        .form-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 0.5rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          padding-right: 2.5rem;
        }
        
        .number-input-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .number-input {
          width: 80px;
          text-align: center;
        }
        
        .input-hint {
          font-size: 13px;
          color: #64748b;
        }
        
        .generate-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: #6366f1;
          color: white;
          border: none;
          padding: 14px 24px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 16px;
        }
        
        .generate-button:hover {
          background-color: #4f46e5;
          transform: translateY(-1px);
        }
        
        .generate-button:active {
          transform: translateY(0);
        }
        
        .button-icon {
          width: 18px;
          height: 18px;
        }
        
        @media (max-width: 640px) {
          .quiz-generator-card {
            padding: 24px;
          }
          
          .form-row {
            flex-direction: column;
            gap: 24px;
          }
        }
      `}</style>
    </div>
  );
};

export default GenerateQuiz;