import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/CourseForm.css';


const CourseForm = () => {
  const [formData, setFormData] = useState({
  title: '',
  description: '',
  objectives: '',
  outcomes: '',
  audienceType: '',
  grade: '',
  board: '',
  country: '',
  degree: '',
  prerequisites: '',
  contactHours: '',
  homeworkHours: '',
  totalWeeks: '',
  creditType: '',
  manualCredits: ''
});
const degreeOptions = [
  // Undergraduate
  "Bachelor of Arts (BA)",
  "Bachelor of Science (BSc)",
  "Bachelor of Commerce (BCom)",
  "Bachelor of Business Administration (BBA)",
  "Bachelor of Engineering (BE)",
  "Bachelor of Technology (BTech)",
  "Bachelor of Computer Applications (BCA)",
  "Bachelor of Education (BEd)",
  "Bachelor of Pharmacy (BPharm)",

  // Postgraduate
  "Master of Arts (MA)",
  "Master of Science (MSc)",
  "Master of Commerce (MCom)",
  "Master of Business Administration (MBA)",
  "Master of Engineering (ME)",
  "Master of Technology (MTech)",
  "Master of Computer Applications (MCA)",
  "Master of Pharmacy (MPharm)",
  "Others"
];

  const navigate = useNavigate();
  const [calculatedCredits, setCalculatedCredits] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [countryList, setCountryList] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateCredits = () => {
    if (formData.creditType !== 'calculated') return;
    
    const contactHours = parseFloat(formData.contactHours) || 0;
    const homeworkHours = parseFloat(formData.homeworkHours) || 0;
    const totalWeeks = parseFloat(formData.totalWeeks) || 0;
    
    const totalHours = (contactHours + homeworkHours) * totalWeeks;
    const credits = Math.round((totalHours / 15) * 2) / 2; // Round to nearest 0.5
    setCalculatedCredits(credits);
  };

  useEffect(() => {
    calculateCredits();
    validateForm();
  }, [formData]);
  useEffect(() => {
  const fetchCountries = async () => {
    try {
      const response = await fetch('https://restcountries.com/v3.1/independent?status=true');
      const data = await response.json();

      if (!Array.isArray(data)) {
        console.error("Country API did not return an array:", data);
        return;
      }

      const countries = data
        .map(country => country.name?.common)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      setCountryList(countries);
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  fetchCountries();
}, []);


  const validateForm = () => {
    const requiredFields = [
      'title', 'description', 'objectives', 'outcomes',
      'audience', 'prerequisites', 'contactHours',
      'homeworkHours', 'totalWeeks', 'creditType'
    ];
    
    const allFieldsFilled = requiredFields.every(field => {
      if (field === 'creditType' && formData[field] === 'manual') {
        return formData.manualCredits.trim() !== '';
      }
      return formData[field].trim() !== '';
    });
    if (!formData.audienceType) return setIsValid(false);
    if (!formData.country) return setIsValid(false);

    // If school student, grade and board must be selected
    if (formData.audienceType === 'school' && (!formData.grade || !formData.board)) return setIsValid(false);
    // If UG/PG/professional, specialization must be present
    if (['undergraduate', 'postgraduate', 'professional'].includes(formData.audienceType) && !formData.specialization) return setIsValid(false);
    setIsValid(allFieldsFilled);
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  setIsGenerating(true);

  try {
    const payload = {
      course_id: `course_${Date.now()}`,
      title: formData.title,
      prerequisites: formData.prerequisites.split(',').map(p => p.trim()),
      description: formData.description,
      learning_objectives: formData.objectives.split('.').map(o => o.trim()).filter(o => o),
      target_audience: formData.audienceType,
      grade : formData.grade,
      board : formData.board,
      degree : formData.degree,
      country: formData.country,
      duration: `${formData.totalWeeks} weeks`,
      credits: formData.creditType === "calculated" ? calculatedCredits : parseFloat(formData.manualCredits)
    };

    const response = await fetch("http://127.0.0.1:8000/course/generate/outline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("API response:", data);


    // Store result (you can pick `data.result` or whole response)
localStorage.setItem("generatedCourse", JSON.stringify({ outline: data.result , suggestions_outlines: data.suggestions}));
localStorage.setItem("course-init", JSON.stringify(payload));
    navigate("/outline");

  } catch (error) {
    console.error(error);
    alert("Failed to generate course. Please try again.");
  } finally {
    setIsGenerating(false);
  }
};


  return (
    <div className="form-column">
      <h1 className="form-title">Welcome to Our AI Course Generator, Let's Get Started.</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Course Title<span  style={{color:'red'}}>*</span></label>
          <input
            type="text"
            className="form-input"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter course title"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Brief Course Description<span  style={{color:'red'}}>*</span></label>
          <textarea
            className="form-input form-textarea"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter brief course description"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Learning Objectives<span  style={{color:'red'}}>*</span></label>
          <textarea
            className="form-input form-textarea"
            name="objectives"
            value={formData.objectives}
            onChange={handleChange}
            placeholder="Enter learning objectives"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Learning Outcomes<span  style={{color:'red'}}>*</span></label>
          <textarea
            className="form-input form-textarea"
            name="outcomes"
            value={formData.outcomes}
            onChange={handleChange}
            placeholder="Enter learning outcomes"
            required
          />
        </div>
        
        <div className="form-group">
        <label className="form-label">Type of Learner<span style={{color:'red'}}>*</span></label>
        <select
          className="form-input form-select"
          name="audienceType"
          value={formData.audienceType}
          onChange={handleChange}
          required
        >
          <option value="">Select learner type</option>
          <option value="school">School Student</option>
          <option value="undergraduate">Undergraduate</option>
          <option value="postgraduate">Postgraduate</option>
          <option value="professional">Working Professional</option>
          <option value="other">Other</option>
        </select>
      </div>
      {formData.audienceType === 'school' && (
  <>
    <div className="form-group">
      <label className="form-label">Grade/Class</label>
      <select
        className="form-input form-select"
        name="grade"
        value={formData.grade}
        onChange={handleChange}
      >
        <option value="">Select grade/class</option>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={`Class ${i + 1}`}>Class {i + 1}</option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label className="form-label">Education Board</label>
      <select
        className="form-input form-select"
        name="board"
        value={formData.board}
        onChange={handleChange}
      >
        <option value="">Select board</option>
        <option value="CBSE">CBSE</option>
        <option value="ICSE">ICSE</option>
        <option value="IB">IB (International Baccalaureate)</option>
        <option value="IGCSE">IGCSE</option>
        <option value="State Board">State Board</option>
        <option value="Other">Other</option>
      </select>
    </div>
  </>
)}

{['undergraduate', 'postgraduate', 'professional'].includes(formData.audienceType) && (
  <>
    <div className="form-group">
  <label className="form-label">Degree<span style={{color:'red'}}>*</span></label>
  <select
    className="form-input form-select"
    name="degree"
    value={formData.degree}
    onChange={handleChange}
    required
  >
    <option value="">Select degree</option>
    {degreeOptions.map((deg, i) => (
      <option key={i} value={deg}>{deg}</option>
    ))}
  </select>
</div>

  </>
)}

<div className="form-group">
  <label className="form-label">Country / Region<span style={{color:'red'}}>*</span></label>
  <select
    className="form-input form-select"
    name="country"
    value={formData.country}
    onChange={handleChange}
    required
  >
    <option value="">Select country</option>
    {countryList.map((country, idx) => (
      <option key={idx} value={country}>{country}</option>
    ))}
  </select>
</div>

        
        <div className="form-group">
          <label className="form-label">Prerequisites to the Course<span  style={{color:'red'}}>*</span></label>
          <textarea
            className="form-input form-textarea"
            name="prerequisites"
            value={formData.prerequisites}
            onChange={handleChange}
            placeholder="Enter course prerequisites"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Weekly Contact Hours<span  style={{color:'red'}}>*</span></label>
          <input
            type="number"
            className="form-input"
            name="contactHours"
            value={formData.contactHours}
            onChange={handleChange}
            placeholder="Enter weekly contact hours"
            min="0"
            step="0.5"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Homework Hours per Week<span  style={{color:'red'}}>*</span></label>
          <input
            type="number"
            className="form-input"
            name="homeworkHours"
            value={formData.homeworkHours}
            onChange={handleChange}
            placeholder="Enter homework hours per week"
            min="0"
            step="0.5"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Total Weeks<span  style={{color:'red'}}>*</span></label>
          <input
            type="number"
            className="form-input"
            name="totalWeeks"
            value={formData.totalWeeks}
            onChange={handleChange}
            placeholder="Enter total weeks"
            min="1"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Credits<span  style={{color:'red'}}>*</span></label>
          <select
  className="form-input form-select"
  name="creditType"
  value={formData.creditType}
  onChange={handleChange}
  required
>
  <option value="" disabled>
    Choose between calculated or manual credit hours *
  </option>
  <option value="calculated">Calculated Credit Hours</option>
  <option value="manual">Manual Override</option>
</select>

        </div>
        
        {formData.creditType === 'manual' && (
          <div className="form-group">
            <label className="form-label">Enter Manual Credit Hours<span  style={{color:'red'}}>*</span></label>
            <input
              type="number"
              className="form-input"
              name="manualCredits"
              value={formData.manualCredits}
              onChange={handleChange}
              placeholder="Enter manual credit hours"
              min="0"
              step="0.5"
              required
            />
          </div>
        )}
        
        {formData.creditType === 'calculated' && (
          <div className="form-group">
            <label className="form-label">Calculated Credit Hours</label>
            <div className="form-input calculated-credits">
              {calculatedCredits} credits
            </div>
          </div>
        )}
        
        <button
          type="submit"
          className="generate-course-btn"
          disabled={!isValid || isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner"></span> Generating...
            </>
          ) : (
            'Generate Course Outline'
          )}
        </button>
      </form>
    </div>
  );
};

export default CourseForm;