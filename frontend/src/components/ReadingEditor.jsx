import React, { useRef, useState, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from 'lowlight';
import { FontSize } from "./font-size";
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import html2canvas from "html2canvas";
import Placeholder from "@tiptap/extension-placeholder";
import Mathematics from "@tiptap/extension-mathematics";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from '@tiptap/extension-text-style';
import Highlight from "@tiptap/extension-highlight";
import { Markdown } from "tiptap-markdown";
import ResizableImage from "tiptap-extension-resize-image";
import CustomImage from "./CustomImage";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./css/ReadingEditor.css";
import FontSizeControl from "./Fontsize";
import { jsPDF } from 'jspdf';
import { useParams } from "react-router-dom";

const convertToMarkdown = (content) => {
  return content
    // Fix LaTeX expressions
    .replace(/```([\s\S]*?)```/g, '```\n$1\n```')
    .replace(/\$sum_/g, '$\\sum_')
    .replace(/\$frac{/g, '$\\frac{')
    .replace(/\$in\b/g, '$\\in')
    .replace(/\$log_/g, '$\\log_')
    .replace(/\\n/g, '\n') // Convert literal \n to real line breaks
    .replace(/\\$/gm, '') // Remove trailing backslashes
    .replace(/\\+/g, '') // Remove stray backslashes
    .replace(/``(.*?)``/gs, '`$1`') // Convert double backticks to single code
    .replace(/“|”|„|‟|❝|❞/g, '"') // Normalize double quotes
    .replace(/‘|’|‚|‛|❮|❯/g, "'") // Normalize single quotes
    .replace(/```(.*?)```/gs, '```\n$1\n```') // Normalize code blocks
    .replace(/\*\*(.*?)\*\*/g, '**$1**') // Normalize bold
    .replace(/\*(.*?)\*/g, '*$1*') // Normalize italic
    .replace(/\[INSERT IMAGE:(.*?)\]/g, '![$1]()') // Image placeholder
    .replace(/\\\s*$/gm, '') // Remove backslash before line endings
    .replace(/\n{3,}/g, '\n\n') // Limit excessive blank lines
    .trim(); // Clean up trailing whitespace
};
const lowlight = createLowlight()
lowlight.register('javascript', javascript);
lowlight.register('python', python);

const ReadingEditor = ({ generatingcontext }) => {
    console.log(generatingcontext);
  const lowlight = createLowlight(common);
  const fileInputRef = useRef(null);
  const [viewMode, setViewMode] = useState("wysiwyg"); // 'wysiwyg' or 'markdown'
  const [markdownContent, setMarkdownContent] = useState("");
  const { moduleId, submoduleId, activity_idx } = useParams();
  const defaultContent = `Welcome, future Data Scientists and Machine Learning enthusiasts!\n\nToday, we're diving into a fascinating area of Supervised Learning: **Decision Trees**. You've already mastered the basics...`;
    const getCurrentActivity = () => {
        const raw = localStorage.getItem("generatedCourse");
        if (!raw) return null;
        
        const generatedCourse = JSON.parse(raw);
        const activity = generatedCourse.modules[moduleId]?.submodules?.[submoduleId]?.activities?.[activity_idx];
        console.log(activity);
        return {
        course: generatedCourse,
        moduleIdx: moduleId,
        submoduleIdx: submoduleId,
        activityIdx: activity_idx,
        activity,
      };
    };
  const [initialContent] = useState(() => {
    const { activity } = getCurrentActivity() || {};
    return activity?.content?.[generatingcontext] || defaultContent;
  });

  const editor = useEditor({
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false}),
    Underline,
    TextStyle,
    FontSize,
    CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: {
        class: 'custom-code-block',
    },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: "Start typing your reading material...",
    }),
    Mathematics.configure({
      HTMLAttributes: {
        class: "latex-block",
      },
      katexOptions: {
        throwOnError: false,
        output: "html",
      },
      renderer: ({ latex }) => katex.renderToString(latex, {
        throwOnError: false,
        output: "html",
      }),
    }),
    CustomImage,
    ResizableImage.configure({
      inline: false,
      allowBase64: true,
      resizable: true,
    }),
    Markdown.configure({
      html: true,
      tightLists: true,
      tightListClass: 'tight',
      bulletListMarker: '-',
      linkify: true,
      breaks: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ],
  content: (initialContent),
  onUpdate({ editor }) {
  const content = viewMode === "wysiwyg" 
    ? editor.getHTML()
    : editor.storage.markdown.getMarkdown();
  
  // Store the complete content
    const ctx = getCurrentActivity();
      if (!ctx) return;

      if (ctx?.course.modules?.[ctx.moduleIdx]?.submodules?.[ctx.submoduleIdx]?.activities?.[ctx.activityIdx]?.content) {
        ctx.course.modules[ctx.moduleIdx].submodules[ctx.submoduleIdx].activities[ctx.activityIdx].content[generatingcontext] = content;
    }

  
  // Additionally store images separately
 editor.state.doc.descendants(node => {
        if (node.type.name === 'image') {
          const storageId = node.attrs['data-storage-id'];
          const base64 = node.attrs.src;
          if (storageId) {
            ctx.course.modules[ctx.moduleIdx].submodules[ctx.submoduleIdx].activities[ctx.activityIdx].content[storageId] = base64;
          }
        }
      });

localStorage.setItem("generatedCourse", JSON.stringify(ctx.course));
},
});


    useEffect(() => {
  if (editor) {
    const { activity } = getCurrentActivity() || {};
    const storedContent = activity?.content?.[generatingcontext] || defaultContent;
    const converted = (storedContent);
    setMarkdownContent(converted);
    
    // Create temporary element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = converted;
    
    // Restore images with all attributes
    const images = tempDiv.querySelectorAll('img');
    images.forEach(img => {
      const storageId = img.getAttribute('data-storage-id');
      if (storageId) {
        const storedImg = localStorage.getItem(storageId);
        if (storedImg) {
          img.setAttribute('src', storedImg);
          // Restore other attributes
          ['width', 'height', 'class'].forEach(attr => {
            const value = img.getAttribute(attr);
            if (value) img.setAttribute(attr, value);
          });
        }
      }
    });
    
    editor.commands.setContent(tempDiv.innerHTML);
  }
}, [editor]);
  
const downloadAsPDF = async () => {
  try {
    const editorElement = document.querySelector('.ProseMirror');

    // Clone editor content
    const clone = editorElement.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.width = `${editorElement.scrollWidth}px`;
    clone.style.padding = '20px'; // Visual padding for canvas
    clone.style.backgroundColor = '#ffffff';
    document.body.appendChild(clone);

    // Wait for all images to load
    const images = clone.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(
        img =>
          new Promise(resolve => {
            if (img.complete) return resolve();
            img.onload = resolve;
            img.onerror = resolve;
          })
      )
    );

    // Render canvas
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    document.body.removeChild(clone); // Clean up

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 10; // 10mm padding on all sides
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const contentHeight = pageHeight - 2 * margin;

    let position = 0;
    let remainingHeight = imgHeight;

    while (remainingHeight > 0) {
      const pageCanvas = document.createElement('canvas');
      const context = pageCanvas.getContext('2d');
      const sliceHeight = Math.min(
        canvas.height - (position * canvas.height) / imgHeight,
        (contentHeight * canvas.width) / imgWidth
      );

      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      context.drawImage(
        canvas,
        0,
        (position * canvas.height) / imgHeight,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      const imgData = pageCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, (sliceHeight * imgWidth) / canvas.width);

      remainingHeight -= contentHeight;
      position += contentHeight;

      if (remainingHeight > 0) pdf.addPage();
    }

    pdf.save('reading-material.pdf');
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Error generating PDF. Try again.');
  }
};

  const toggleViewMode = () => {
    if (viewMode === "wysiwyg") {
      setMarkdownContent(editor.storage.markdown.getMarkdown());
      setViewMode("markdown");
    } else {
      editor.commands.setContent(markdownContent);
      setViewMode("wysiwyg");
    }
  };

  const triggerImageUpload = () => fileInputRef.current?.click();

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check file size (200KB limit)
        if (file.size > 200 * 1024) {
            alert('Image size must be less than 200KB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result;
            // Store image in localStorage with unique ID
            const imageId = `img-${Date.now()}`;
            localStorage.setItem(imageId, base64);
            
            // Insert image with reference to localStorage ID
            editor.chain().focus().setImage({ 
            src: base64,
            'data-storage-id': imageId 
            }).run();
        };
        reader.readAsDataURL(file);
        };
  const insertMath = () => {
    const formula = prompt("Enter LaTeX formula:");
    if (formula) {
      editor.chain().focus().insertContent(`$$${formula}$$`).run();
    }
  };

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="reading-editor-container">
      <div className="editor-toolbar">
        <div className="formatting-buttons">
            <FontSizeControl editor={editor} 
                onClick={() => {
                const current = editor.getAttributes('textStyle').fontSize;
                const size = prompt('Font size (px):', current ? current.replace('px', '') : '12');
                if (size) {
                    const pxSize = size.match(/^\d+$/) ? `${size}px` : size;
                    editor.chain().focus().setFontSize(pxSize).run();
                }
                }}
            />
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "is-active" : ""}
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "is-active" : ""}
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive("underline") ? "is-active" : ""}
          >
            <u>U</u>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive("highlight") ? "is-active" : ""}
          >
            Highlight
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "is-active" : ""}
          >
            List
          </button>
          <button onClick={triggerImageUpload}>Insert Image</button>
          <button onClick={insertMath}>Insert Math</button>
          <button onClick={downloadAsPDF} className="pdf-download-btn" hidden>
            Download PDF
            </button>
        </div>
        <div className="view-mode-toggle">
          <button onClick={toggleViewMode}>
            Switch to {viewMode === "wysiwyg" ? "Markdown" : "WYSIWYG"} View
          </button>
          <button onClick={() => editor.chain().focus().updateAttributes('image', { class: 'align-left' }).run()}>
            Align Left
            </button>
            <button onClick={() => editor.chain().focus().updateAttributes('image', { class: 'align-center' }).run()}>
            Align Center
            </button>
            <button onClick={() => editor.chain().focus().updateAttributes('image', { class: 'align-right' }).run()}>
            Align Right
            </button>
            <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? 'is-active' : ''}
            >
            Code Block
            </button>
        </div>
      </div>

      {viewMode === "wysiwyg" ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
            className="markdown-editor"
            value={markdownContent}
            onChange={(e) => setMarkdownContent(e.target.value)}
            onBlur={() => {
                editor.commands.setContent(markdownContent);
                localStorage.setItem(`${generatingcontext}`, markdownContent); // <-- Ensure localStorage update
            }}
        />

      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: "none" }}
      />
    </div>
  );
};

export default ReadingEditor;