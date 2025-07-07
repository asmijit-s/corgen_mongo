import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import './css/QuizEditor.css';
const QuizEditor = () => {
  const { moduleIdx, submoduleIdx, activityIdx } = useParams();
  const navigate = useNavigate();
  const [quizData, setQuizData] = useState({ questions: [] });
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState({
    id: uuidv4(),
    quizQuestion: '',
    options: [{ id: uuidv4(), text: '', isCorrect: false }],
    answerExplanation: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const loadQuiz = () => {
      try {
        const courseData = JSON.parse(localStorage.getItem('generatedCourse'));
        
        const activity = courseData?.modules?.[moduleIdx]?.submodules?.[submoduleIdx]?.activities?.[activityIdx];
        
        if (!activity) throw new Error('Activity not found');
        if (activity.activity_type !== 'quiz') throw new Error('Not a quiz activity');
        
        // Initialize with empty array if no questions exist
        const loadedData = activity.content || { questions: [] };
        
        // Ensure each question and option has an ID for proper management
        const normalizedQuestions = loadedData.questions.map(question => ({
          ...question,
          id: question.id || uuidv4(),
          options: question.options.map(option => ({
            id: option.id || uuidv4(),
            text: option.text || option, // handle both string and object formats
            isCorrect: option.isCorrect || question.correctAnswer === (option.text || option)
          }))
        }));
        
        setQuizData({ ...loadedData, questions: normalizedQuestions });
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadQuiz();
  }, [moduleIdx, submoduleIdx, activityIdx]);
  useEffect(() => {
  if (!loading) {
    const courseData = JSON.parse(localStorage.getItem('generatedCourse'));
    if (!courseData?.modules?.[moduleIdx]?.submodules?.[submoduleIdx]?.activities?.[activityIdx]) return;

    courseData.modules[moduleIdx].submodules[submoduleIdx].activities[activityIdx].content = quizData;
    localStorage.setItem('generatedCourse', JSON.stringify(courseData));
  }
}, [quizData]); // <-- save every time quizData changes

  const saveQuizToLocalStorage = () => {
    const courseData = JSON.parse(localStorage.getItem('generatedCourse'));
    courseData.modules[moduleIdx].submodules[submoduleIdx].activities[activityIdx].content = quizData;
    localStorage.setItem('generatedCourse', JSON.stringify(courseData));
  };

  const resetCurrentQuestion = () => {
    setCurrentQuestion({
      id: uuidv4(),
      quizQuestion: '',
      options: [{ id: uuidv4(), text: '', isCorrect: false }],
      answerExplanation: ''
    });
  };

  const openAddQuestionModal = () => {
    resetCurrentQuestion();
    setEditingQuestionId(null);
    setIsModalOpen(true);
  };

  const openEditQuestionModal = (question) => {
    setCurrentQuestion({
      ...question,
      options: question.options.map(opt => ({ ...opt })) // create a copy
    });
    setEditingQuestionId(question.id);
    setIsModalOpen(true);
  };

  const handleAddOption = () => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: [...prev.options, { id: uuidv4(), text: '', isCorrect: false }]
    }));
  };

  const handleRemoveOption = (optionId) => {
    const updatedOptions = currentQuestion.options.filter(opt => opt.id !== optionId);
    
    // Ensure at least one option remains
    if (updatedOptions.length === 0) {
      updatedOptions.push({ id: uuidv4(), text: '', isCorrect: false });
    }
    
    setCurrentQuestion(prev => ({
      ...prev,
      options: updatedOptions
    }));
  };

  const handleOptionChange = (optionId, field, value) => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: prev.options.map(opt => 
        opt.id === optionId ? { ...opt, [field]: value } : opt
      )
    }));
  };

const handleCorrectAnswerChange = (selectedOptionId) => {
  setCurrentQuestion(prev => ({
    ...prev,
    options: prev.options.map(opt => ({
      ...opt,
      isCorrect: opt.id === selectedOptionId // only this one is true
    }))
  }));
  saveQuizToLocalStorage();
};


  const validateQuestion = () => {
    const { quizQuestion, options } = currentQuestion;
    
    if (!quizQuestion.trim()) {
      return { valid: false, error: 'Question text is required' };
    }
    
    if (options.some(opt => !opt.text.trim())) {
      return { valid: false, error: 'All options must have text' };
    }
    
    if (!options.some(opt => opt.isCorrect)) {
      return { valid: false, error: 'At least one correct answer must be selected' };
    }
    
    return { valid: true };
  };

  const handleSaveQuestion = () => {
    const validation = validateQuestion();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    const questionToSave = {
      ...currentQuestion,
      // Clean up options format for storage
      options: currentQuestion.options.map(({ id, text, isCorrect }) => ({ id, text, isCorrect }))
    };
    
    if (editingQuestionId) {
      // Update existing question
      setQuizData(prev => ({
        ...prev,
        questions: prev.questions.map(q => 
          q.id === editingQuestionId ? questionToSave : q
        )
      }));
    } else {
      // Add new question
      setQuizData(prev => ({
        ...prev,
        questions: [...prev.questions, questionToSave]
      }));
    }
    
    saveQuizToLocalStorage();
    setIsModalOpen(false);
    resetCurrentQuestion();
  };

  const handleDeleteQuestion = (questionId) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setQuizData(prev => ({
        ...prev,
        questions: prev.questions.filter(q => q.id !== questionId)
      }));
      saveQuizToLocalStorage();
    }
  };

  if (loading) return <div className="loading">Loading quiz...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="quiz-editor-container">
      <style jsx>{`
        
      `}</style>

      <div className="header-quiz">
        <button className="back-button" onClick={() => navigate("/generate")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Course
        </button>
        <h1 className="title">Quiz Editor</h1>
      </div>

      <div className="actions-section">
        <button className="add-question-button" onClick={openAddQuestionModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add New Question
        </button>
      </div>

      <div className="questions-section">
        <h2 className="section-title">Quiz Questions ({quizData.questions.length})</h2>
        
        {quizData.questions.length === 0 ? (
          <div className="no-questions">
            <p>No questions have been added yet.</p>
            <button className="add-question-button" onClick={openAddQuestionModal}>
              Add Your First Question
            </button>
          </div>
        ) : (
          <div className="question-list">
            {quizData.questions.map((question, index) => (
              <div key={question.id} className="question-item">
                <div className="question-header">
                  <h3 className="question-text">
                    {index + 1}. {question.quizQuestion}
                  </h3>
                  <div className="question-actions">
                    <button
                      className="action-button edit-button"
                      onClick={() => openEditQuestionModal(question)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </button>
                    <button
                      className="action-button delete-button"
                      onClick={() => handleDeleteQuestion(question.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>

                <div className="options-list">
                  {question.options.map((option) => (
                    <div key={option.id} className="option-item">
                      <div className={`correct-indicator ${option.isCorrect ? 'correct' : 'incorrect'}`} />
                      <span className={option.isCorrect ? 'correct-text' : ''}>
                        {option.text}
                      </span>
                    </div>
                  ))}
                </div>

                {question.answerExplanation && (
                  <div className="explanation">
                    <p className="explanation-text">
                      <strong>Explanation:</strong> {question.answerExplanation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question Editor Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingQuestionId ? 'Edit Question' : 'Add New Question'}
              </h2>
              <button className="close-button" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Question Text</label>
              <input
                type="text"
                className="form-input"
                value={currentQuestion.quizQuestion}
                onChange={(e) => setCurrentQuestion(prev => ({
                  ...prev,
                  quizQuestion: e.target.value
                }))}
                placeholder="Enter the question"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Options</label>
              <div className="options-container">
                {currentQuestion.options.map((option) => (
                  <div key={option.id} className="option-row">
                    <input
                      type="text"
                      className="form-input option-input"
                      value={option.text}
                      onChange={(e) => handleOptionChange(
                        option.id,
                        'text',
                        e.target.value
                      )}
                      placeholder="Option text"
                    />
                    <div className="option-actions">
                      <input
                        type="radio"
                        className="option-radio"
                        name="correctOption"
                        checked={option.isCorrect}
                        onChange={() => handleCorrectAnswerChange(option.id)}
                      />
                      <button
                        className="remove-option-button"
                        onClick={() => handleRemoveOption(option.id)}
                        disabled={currentQuestion.options.length <= 1}
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="add-option-button"
                  onClick={handleAddOption}
                  disabled={currentQuestion.options.length >= 6}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add Option
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Explanation (Optional)</label>
              <textarea
                className="form-textarea"
                value={currentQuestion.answerExplanation}
                onChange={(e) => setCurrentQuestion(prev => ({
                  ...prev,
                  answerExplanation: e.target.value
                }))}
                placeholder="Explain why this is the correct answer"
              />
            </div>

            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="modal-button save-button"
                onClick={handleSaveQuestion}
              >
                {editingQuestionId ? 'Update Question' : 'Save Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizEditor;