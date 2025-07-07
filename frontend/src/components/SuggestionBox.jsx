import React, { useState, useRef, useEffect } from "react";
import { useParams,useLocation } from "react-router-dom";
import "./css/SuggestionBox.css";

const getStageFromPath = (path) => {
  if (path.includes("/outline")) return "outlines";
  if (path.includes("/modules")) return "modules";
  if (path.includes("/submodules/")) return "submodules";
  if (path.includes("/activities/")) return "activities";
  return null;
};

const SuggestionWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const panelRef = useRef(null);
  const location = useLocation();
  const stage = getStageFromPath(location.pathname);
  const isVisible = !!stage;
  const pathParts = location.pathname.split("/"); 

  let moduleId = null;
  let submoduleId = null;

  if (pathParts[1] === "submodules" && pathParts[2]) {
    moduleId = parseInt(pathParts[2]);
  } else if (pathParts[1] === "activities" && pathParts[2] && pathParts[3]) {
    moduleId = parseInt(pathParts[2]);
    submoduleId = parseInt(pathParts[3]);
  }
  // Load suggestions from localStorage when stage or pathname changes
 useEffect(() => {
    const raw = localStorage.getItem("generatedCourse");
    if (!stage || !raw) return;

    try {
      const parsed = JSON.parse(raw);
      let suggestionsList = [];

      if (stage === "outlines") {
        suggestionsList = parsed.suggestions_outlines?.suggestions || [];

      } else if (stage === "modules") {
        suggestionsList = parsed.suggestions_modules?.suggestions || [];

      } else if (stage === "submodules") {
        const module = parsed.modules?.[parseInt(moduleId)];
        suggestionsList = module?.suggestions_submodules?.suggestions || [];
      } else if (stage === "activities") {
        const module = parsed.modules?.[parseInt(moduleId)];
        const submodule = module?.submodules?.[parseInt(submoduleId)];
        suggestionsList = submodule?.suggestions_activities?.suggestions || [];
      }

      setSuggestions(suggestionsList);
    } catch (err) {
      console.error("Failed to extract suggestions:", err);
      setSuggestions([]);
    }
  }, [stage, location.pathname, moduleId, submoduleId]);


  // Handle outside click to close the panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div className="suggestion-widget">
      {!isOpen && (
        <div className="floating-btn" onClick={() => setIsOpen(true)}>
          View Suggestions
        </div>
      )}

      {isOpen && (
        <div className="suggestion-panel" ref={panelRef}>
          <div className="suggestion-header">
            <h4>Suggestions</h4>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>
          {suggestions.length > 0 ? (
            <ul>
              {suggestions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No suggestions available for this stage.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SuggestionWidget;
