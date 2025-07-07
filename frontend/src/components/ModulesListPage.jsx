import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import './css/ModulesListPage.css';

const ModulesListPage = () => {
  const [modules, setModules] = useState([]);
  const [loadingModuleIndex, setLoadingModuleIndex] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("generatedCourse");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.modules) {
        setModules(parsed.modules);
      }
    }
  }, []);

  const handleModuleClick = async (index) => {
    const module = modules[index];

    // Do nothing if submodules already exist or it's loading
    if ((module.submodules && module.submodules.length > 0) || loadingModuleIndex === index) {
      navigate(`/submodules/${index}`);
      return;
    }

    try {
      setLoadingModuleIndex(index); // Mark as loading

      const response = await fetch("http://localhost:8000/course/generate/submodules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: module.module_id,
          module_title: module.module_title,
          module_description: module.module_description,
          module_hours: module.module_hours,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate submodules");
      }

      const data = await response.json();
      const generatedSubmodules = data.result.submodules || [];

      const updatedModules = [...modules];
      updatedModules[index] = {
        ...updatedModules[index],
        submodules: generatedSubmodules,
        suggestions_submodules: data.suggestions
      };

      setModules(updatedModules);

      const courseData = JSON.parse(localStorage.getItem("generatedCourse")) || {};
      courseData.modules = updatedModules;
      localStorage.setItem("generatedCourse", JSON.stringify(courseData));

      navigate(`/submodules/${index}`);
    } catch (error) {
      console.error("Error generating submodules:", error);
      alert("Failed to generate submodules. Please try again.");
    } finally {
      setLoadingModuleIndex(null); // Reset loading
    }
  };

  return (
    <div className="modules-container">
      <div className="modules-header">
        <h1>Create Submodules</h1>
      </div>

      <div className="modules-list">
        {modules.map((module, index) => {
          const hasSubmodules = module.submodules && module.submodules.length > 0;
          const isLoading = loadingModuleIndex === index;

          return (
            <div
              key={index}
              className={`module-card ${isLoading ? 'disabled' : ''}`}
              onClick={() => !isLoading && handleModuleClick(index)}
              style={{ cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
            >
              <div className="module-content">
                <div className="module-info">
                  <h3 className="module-title">{module.module_title}</h3>
                  <div className="module-description">{module.module_description}</div>
                  <div className="module-hours">
                    Duration: <span>{module.module_hours}</span>
                    {hasSubmodules && (
                      <span className="submodules-count">• {module.submodules.length} submodules</span>
                    )}
                  </div>
                </div>
                <div className="module-arrow-container">
                  <span className="module-arrow-text">
                    {isLoading
                      ? "Creating..."
                      : hasSubmodules
                      ? "Manage"
                      : "Create"} Submodules
                  </span>
                  {!isLoading && <FiArrowRight className="module-arrow-icon" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="modules-footer">
        <button
          className="generate-course-btn"
          onClick={() => navigate('/activities')}
          disabled={!modules.every(mod => mod.submodules && mod.submodules.length > 0)}
          style={{
            opacity: modules.every(mod => mod.submodules && mod.submodules.length > 0) ? 1 : 0.5,
            cursor: modules.every(mod => mod.submodules && mod.submodules.length > 0)
              ? 'pointer'
              : 'not-allowed',
          }}
        >
          Save & Continue
        </button>
      </div>
    </div>
  );
};

export default ModulesListPage;
