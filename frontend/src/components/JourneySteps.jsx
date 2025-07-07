import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './css/CourseGenerationProgress.css';

const steps = [
  'Course Overview',
  'Course Outline',
  'Modules',
  'Sub Modules',
  'Activities',
  'Final BluePrint',
  'Content Generation'
];

// const pathToStepMap = {
//   '/': 1,
//   '/outline': 2,
//   '/modules': 3,
//   '/submodules': 4,
//   '/activities': 5,
//   '/blueprint': 6,
//   '/content': 7
// };

const stepToPathMap = {
  1: '/',
  2: '/outline',
  3: '/modules',
  4: '/submodules',
  5: '/activities',
  6: '/blueprint',
  7: '/generate'
};

const CourseGenerationProgress = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname;
  let currentStep = 1;

if (currentPath === '/') {
  currentStep = 1;
} else if (currentPath === '/outline') {
  currentStep = 2;
} else if (currentPath === '/modules') {
  currentStep = 3;
} else if (currentPath.startsWith('/submodules')) {
  currentStep = 4;
} else if (currentPath.startsWith('/activities')) {
  currentStep = 5;
} else if (currentPath === '/blueprint') {
  currentStep = 6;
} else if (currentPath === '/generate'||currentPath.startsWith('/generate_lecture') ||currentPath.startsWith('/generate_reading') ||currentPath.startsWith('/quiz_editor')   ||currentPath.startsWith('/generate_quiz')  ||currentPath.startsWith('/upload_document') ) {
  currentStep = 7;
}


  const handleStepClick = (stepNumber) => {
    if (stepNumber > currentStep) {
      alert("You can't navigate to this step yet. Please complete the previous steps.");
      return;
    }

    const confirm = window.confirm(`Do you want to navigate to "${steps[stepNumber - 1]}"?`);
    if (confirm) {
      navigate(stepToPathMap[stepNumber]);
    }
  };

  return (
    <div className="progress-section">
      <div className="progress-title"><h3>Course Generation Progress</h3></div>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = currentStep > stepNumber;
        const isActive = currentStep === stepNumber;
        const isClickable = isCompleted || isActive;

        return (
          <div
            key={index}
            className={`progress-item 
              ${isCompleted ? 'completed' : ''}
              ${isActive ? 'active' : ''}
              ${!isCompleted && !isActive ? 'inactive' : ''}`}
            onClick={() => isClickable && handleStepClick(stepNumber)}
            style={{ cursor: isClickable ? 'pointer' : 'not-allowed' }}
          >
            <span>{step}</span>
            {isCompleted && <div className="check-icon">✓</div>}
          </div>
        );
      })}
    </div>
  );
};

export default CourseGenerationProgress;
