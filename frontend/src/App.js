// App.js
import React, { useState, useRef, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import CourseGenerationProgress from "./components/JourneySteps.jsx";
import ModificationSelector from "./components/UserInputPanel.jsx";
import CourseOutline from "./components/CourseOutline.jsx";
import CourseForm from "./components/CourseForm.jsx";
import ModulesPage from "./components/ModulePage.jsx";
import ModulesListPage from "./components/ModulesListPage.jsx";
import SubmodulesPage from "./components/SubModule.jsx";
import ActivitiesPage from "./components/Activtity.jsx";
import ModulesDropdownPage from "./components/ModuleDropdown.jsx";
import BlueprintPage from "./components/Blueprint.jsx";
import GenerationPage from './components/Generation';  // No `.jsx` in import
import { FiChevronUp, FiChevronDown } from 'react-icons/fi'; // add this at the top
import NotFoundPage from "./components/NotFound.jsx";
import SuggestionWidget from "./components/SuggestionBox.jsx";
import ReadingPage from "./components/Generate_reading.jsx";
import LecturePage from "./components/GenerateLecture.jsx";
import QuizEditor from "./components/QuizEditor.jsx";
import GenerateQuiz from "./components/GenerateQuiz.jsx";
import "./App.css";

function generateOptionsFromLocalStorage(context = 'outline') {
  const raw = localStorage.getItem("generatedCourse");
  if (!raw) return [];
  const data = JSON.parse(raw);

  if (context === 'outline' && data.outline) {
    const options = Object.keys(data.outline).map(key => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: key,
      fullValue: data.outline
    }));
    return [{ label: "All", value: "all", fullValue: data.outline }, ...options];
  }

  if (context === 'modules' && data.modules) {
    const modulesWithoutSubmodules = Object.fromEntries(
    Object.entries(data.modules).map(([key, module]) => {
      const { submodules, ...rest } = module; // exclude submodules
      return [key, rest];
    })
  );
  const options = Object.entries(modulesWithoutSubmodules).map(([key, value]) => ({
    label: value.module_title,
    value: value.module_id,
    fullValue: modulesWithoutSubmodules
  }));
    return [{ label: "All", value: "all", fullValue: modulesWithoutSubmodules }, ...options];
  }
  if (context === 'submodules') {
    const path = window.location.pathname;
    const match = path.match(/\/submodules\/(\d+)/);
    const moduleIndex = match ? parseInt(match[1]) : null;

    if (
      moduleIndex !== null &&
      Array.isArray(data.modules) &&
      data.modules[moduleIndex]?.submodules
    ) {
      // const submods = data.modules[moduleIndex].submodules;
      // Remove `activities` from each submodule
    const submodsWithoutActivities = data.modules[moduleIndex].submodules.map(sub => {
      const { activities, ...rest } = sub;
      return rest;
    });

    const submodDict = submodsWithoutActivities.reduce((acc, sub) => {
      acc[sub.submodule_id] = sub;
      return acc;
    }, {});


    const options = submodsWithoutActivities.map((sub, idx) => ({
      label: sub.submodule_title,
      value: sub.submodule_id,
      fullValue: submodDict
    }));
      return [{ label: "All", value: "all", fullValue: submodDict }, ...options];
    }
  }
  if (context === 'activities') {
    const path = window.location.pathname;
    const match = path.match(/\/activities\/(\d+)\/(\d+)/);
    const moduleIndex = match ? parseInt(match[1]) : null;
    const submoduleIndex = match ? parseInt(match[2]) : null;

    if (
      moduleIndex !== null &&
      submoduleIndex !== null &&
      Array.isArray(data.modules) &&
      data.modules[moduleIndex]?.submodules &&
      data.modules[moduleIndex].submodules[submoduleIndex]?.activities
    ) {
      const activities = data.modules[moduleIndex].submodules[submoduleIndex].activities;
      const options = activities.map((activity, idx) => ({
        label: activity.activity_name || `Activity ${idx + 1}`,
        value: activity.activity_name || `Activity ${idx + 1}`,
        fullValue: activities
      }));
      return [{ label: "All", value: "all", fullValue: activities }, ...options];
    }
  }
  if (context === 'lecture') {
  const path = window.location.pathname;
  const match = path.match(/\/(\d+)\/(\d+)\/(\d+)/); // matches /:moduleId/:submoduleId/:activity_idx
  const moduleIndex = match ? parseInt(match[1]) : null;
  const submoduleIndex = match ? parseInt(match[2]) : null;
  const activityIndex = match ? parseInt(match[3]) : null;

  if (
    moduleIndex !== null &&
    submoduleIndex !== null &&
    Array.isArray(data.modules) &&
    data.modules[moduleIndex]?.submodules &&
    data.modules[moduleIndex].submodules[submoduleIndex]?.activities
  ) {
    const activities = data.modules[moduleIndex].submodules[submoduleIndex].activities;

    const options = [];

    // Push lecture script option
    if (activities[activityIndex]?.content?.lectureScript) {
      options.push({
        label: "Lecture Script",
        value: "lectureScript",
        fullValue: {
          lectureScript: activities[activityIndex].content.lectureScript,
          summary: activities[activityIndex].content.summary
        }
      });
    }

    // Push summary option
    if (activities[activityIndex]?.content?.summary) {
      options.push({
        label: "Summary",
        value: "summary",
        fullValue: {
          lectureScript: activities[activityIndex].content.lectureScript,
          summary: activities[activityIndex].content.summary
        }
      });
    }

    // Push "All" if both lecture and summary exist
    if (
      activities[activityIndex]?.content?.lectureScript &&
      activities[activityIndex]?.content?.summary
    ) {
      options.unshift({
        label: "All",
        value: "all",
        fullValue: {
          lectureScript: activities[activityIndex].content.lectureScript,
          summary: activities[activityIndex].content.summary
        }
      });
    }

    return options;
  }
}
if (context === 'reading') {
  const path = window.location.pathname;
  const match = path.match(/\/(\d+)\/(\d+)\/(\d+)/); // /:moduleId/:submoduleId/:activity_idx
  const moduleIndex = match ? parseInt(match[1]) : null;
  const submoduleIndex = match ? parseInt(match[2]) : null;
  const activityIndex = match ? parseInt(match[3]) : null;

  if (
    moduleIndex !== null &&
    submoduleIndex !== null &&
    Array.isArray(data.modules) &&
    data.modules[moduleIndex]?.submodules?.[submoduleIndex]?.activities?.[activityIndex]
  ) {
    const reading = data.modules[moduleIndex].submodules[submoduleIndex].activities[activityIndex]?.content?.readingMaterial;

    if (reading) {
      return [{
        label: "Reading Material",
        value: "readingMaterial",
        fullValue: {"readingMaterial": reading}
      }];
    }
  }
}

if (context === 'quiz') {
  const path = window.location.pathname;
  const match = path.match(/\/(\d+)\/(\d+)\/(\d+)/); // /:moduleId/:submoduleId/:activity_idx
  const moduleIndex = match ? parseInt(match[1]) : null;
  const submoduleIndex = match ? parseInt(match[2]) : null;
  const activityIndex = match ? parseInt(match[3]) : null;

  if (
    moduleIndex !== null &&
    submoduleIndex !== null &&
    Array.isArray(data.modules) &&
    data.modules[moduleIndex]?.submodules?.[submoduleIndex]?.activities?.[activityIndex]
  ) {
    const quizContent = data.modules[moduleIndex].submodules[submoduleIndex].activities[activityIndex]?.content;
    const questions = quizContent?.questions || [];

    const options = questions.map((q, idx) => ({
      label: q.quizQuestion?.trim() ? q.quizQuestion : `Question ${idx + 1}`,
      value: `${idx}`,
      fullValue: questions
    }));

    if (questions.length > 0) {
      options.unshift({
        label: "All",
        value: "all",
        fullValue: questions
      });
    }

    return options;
  }
}

  return [];
}

function AppContent() {
  const location = useLocation();
  const [options, setOptions] = useState([]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const isResizing = useRef(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // NEW
  const [stage ,setstage] = useState([]);
  const toggleCollapse = () => setIsCollapsed(prev => !prev);
  
  const handleMouseDown = () => { isResizing.current = true; };
  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    setLeftPanelWidth(Math.max(200, Math.min(e.clientX, 600)));
  };
  const handleMouseUp = () => { isResizing.current = false; };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (location.pathname.includes("/outline")) {
      setOptions(generateOptionsFromLocalStorage("outline"));
      setstage("outline");
    } else if (location.pathname.includes("/modules")) {
      setOptions(generateOptionsFromLocalStorage("modules"));
      setstage("module");
    } else if(location.pathname.includes("/submodules/")){
      setOptions(generateOptionsFromLocalStorage("submodules"));
      setstage("submodule");
    }else if (location.pathname.includes("/activities/")) {
      setOptions(generateOptionsFromLocalStorage("activities"));
      setstage("activity");
    }else if (location.pathname.includes("/generate_lecture/")) {
      setOptions(generateOptionsFromLocalStorage("lecture"));
      setstage("lecture");
    }else if (location.pathname.includes("/generate_reading/")) {
      setOptions(generateOptionsFromLocalStorage("reading"));
      setstage("reading");
    }else if (location.pathname.includes("/quiz_editor/")) {
      setOptions(generateOptionsFromLocalStorage("quiz"));
      setstage("quiz");
    } else {
      setOptions([]);
    }
  }, [location.pathname]);


  return (
    <div className="app-container">
      <Navbar />
      <div className="main-layout">
        <div className="left-panel" style={{ width: leftPanelWidth }}>
          <CourseGenerationProgress />
          {/* Collapsible Header */}
          <div 
            className="modification-toggle-header"
            onClick={toggleCollapse}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, #6b46c1, #8b5cf6)',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              height: 'fit-content',
              width:'-webkit-fill-available',
              color:'white'
            }}
          >
            <span><strong>Modify Content</strong></span>
            {isCollapsed ? <FiChevronDown /> : <FiChevronUp />}
          </div>

          {/* Conditionally show ModificationSelector */}
          {!isCollapsed && (
            <ModificationSelector 
              options={options.map(({ label, value, fullValue }) => ({ label, value, fullValue }))}  
              stage={stage}
            />
          )}
        </div>
        <div className="drag-handle" onMouseDown={handleMouseDown} style={{ left: leftPanelWidth - 2 }} />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<CourseForm />} />
            <Route path="/outline" element={<CourseOutline />} />
            <Route path="/modules" element={<ModulesPage />} />
            <Route path="/submodules" element={<ModulesListPage />} />
            <Route path="/submodules/:id" element={<SubmodulesPage />} />
            <Route path="/activities" element={<ModulesDropdownPage />} />
            <Route path="/activities/:moduleId/:submoduleId" element={<ActivitiesPage />} />
            <Route path="/blueprint" element={<BlueprintPage />} />
            <Route path="/:nothing" element={<NotFoundPage />} />
            <Route path="/generate" element={<GenerationPage />} />
            <Route path="/generate_reading/:moduleId/:submoduleId/:activity_idx" element={<ReadingPage />} />
            <Route path="/generate_lecture/:moduleId/:submoduleId/:activity_idx" element={<LecturePage />} />
            <Route path="/generate_quiz/:moduleIdx/:submoduleIdx/:activityIdx" element={<GenerateQuiz />} />
            <Route path="/quiz_editor/:moduleIdx/:submoduleIdx/:activityIdx" element={<QuizEditor />} />
          </Routes>
          <SuggestionWidget/>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
