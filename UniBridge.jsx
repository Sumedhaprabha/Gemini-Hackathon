import React, { useState, useEffect, useCallback } from 'react';

// --- Global Constants & Mock Data ---
const MOCK_STUDENT_NAME = "Alex Chen";

// The following variables are provided by the Canvas environment at runtime.
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const FIREBASE_CONFIG = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const INITIAL_AUTH_TOKEN = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
const GEMINI_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const API_KEY = ""; // Kept empty, handled by the environment

// Mock Course Data (The 'Moodle Content' placeholder)
const mockCourseData = [
  {
    id: 'CS401', title: 'Advanced Data Structures', venue: 'Eng 305', instructor: 'Dr. V. Patel',
    schedule: 'Mon/Wed 10:00 - 11:30 AM', exam: 'Final Exam: Dec 15th, 9:00 AM (Location TBA)',
    moodle: [
      { type: 'Lecture', title: 'Hash Tables vs Trees', uploaded: 'Oct 1st' },
      { type: 'Reading', title: 'Chapter 5: AVL Rotations', uploaded: 'Oct 8th' },
      { type: 'Assignment', title: 'Problem Set 4 (Due 10/25)', uploaded: 'Oct 15th' },
      { type: 'Lecture', title: 'Dynamic Programming Introduction', uploaded: 'Oct 18th' },
    ]
  },
  {
    id: 'HIS210', title: 'Modern European History', venue: 'Arts Hall 101', instructor: 'Prof. L. Smith',
    schedule: 'Tue/Thu 1:00 - 2:30 PM', exam: 'Midterm: Nov 5th, Essay Submission',
    moodle: [
      { type: 'Reading', title: 'The Rise of Nationalism', uploaded: 'Sep 20th' },
      { type: 'Lecture', title: 'WWI Causes and Effects', uploaded: 'Oct 10th' },
      { type: 'Resource', title: 'Primary Source Archive Link', uploaded: 'Oct 1st' },
    ]
  },
];

// Simulated Firebase/Firestore Imports (using mock functions for demo)
const initializeApp = (config) => ({ name: 'FirebaseApp' });
const getAuth = (app) => ({ name: 'FirebaseAuth' });
const getFirestore = (app) => ({ name: 'FirestoreDB' });
const doc = (db, path, ...segments) => ({ path: `${path}/${segments.join('/')}` });
const collection = (db, path, ...segments) => ({ path: `${path}/${segments.join('/')}` });
const query = (col) => ({ ...col, isQuery: true });
const onSnapshot = (q, callback) => {
    // Simulated real-time listener with mock data
    const mockData = {
      deadlines: [
        { id: 1, type: 'Assignment', title: 'Calculus III Problem Set', date: '2025-10-25', status: 'Upcoming', course: 'CS401' },
        { id: 2, type: 'Exam', title: 'Data Structures Midterm', date: '2025-11-05', status: 'Upcoming', course: 'CS401' },
        { id: 3, type: 'Library', title: 'Return "Deep Learning" book', date: '2025-10-22', status: 'Due Soon', course: 'General' },
        { id: 4, type: 'Project', title: 'History Final Paper Draft', date: '2025-11-15', status: 'Upcoming', course: 'HIS210' },
        { id: 5, type: 'Assignment', title: 'History Reading Response', date: '2025-10-21', status: 'Due Today', course: 'HIS210' },
      ],
      schedule: [
        { id: 101, title: 'Adv. Data Structures (CS401)', time: '10:00 - 11:30', day: 'Mon', date: '2025-10-21', overlaps: false },
        { id: 102, title: 'Calculus III Tutorial', time: '14:00 - 15:00', day: 'Mon', date: '2025-10-21', overlaps: false },
        { id: 103, title: 'Focused Study Block', time: '15:30 - 17:30', day: 'Mon', date: '2025-10-21', overlaps: true, suggested: '18:00 - 20:00' },
        { id: 104, title: 'Team Meeting (Project)', time: '16:00 - 17:00', day: 'Mon', date: '2025-10-21', overlaps: true },
        { id: 105, title: 'Modern European History (HIS210)', time: '1:00 - 2:30', day: 'Tue', date: '2025-10-22', overlaps: false },
      ],
    };
    callback({ docs: [mockData] }); // Pass mock data to simulate successful fetch
    return () => console.log('Simulated snapshot detached.'); // Mock unsubscribe
};

const signInWithCustomToken = (auth, token) => ({ user: { uid: 'user-auth-' + token.substring(0, 5) } });
const signInAnonymously = (auth) => ({ user: { uid: 'user-anon-' + Math.random().toString(36).substring(2, 7) } });
const onAuthStateChanged = (auth, callback) => {
  const user = INITIAL_AUTH_TOKEN ? { uid: 'user-auth-token' } : null;
  setTimeout(() => callback(user), 100);
  return () => {}; // Mock unsubscribe
};
const setLogLevel = (level) => console.log(`Firebase Log Level set to: ${level}`);

// Utility function for API retries
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response;
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
      } else {
        throw error;
      }
    }
  }
};

// --- Mock Data for Side Panels (used in HomeView) ---
const mockEmailSummaries = [
  { id: 201, from: 'Prof. Smith (DS)', summary: 'Reminder: Midterm review session today at 5 PM in room C-101. Optional but recommended.' },
  { id: 202, from: 'Webmail Admin', summary: 'Security Update: Your password will expire in 7 days. Please change it.' },
];

const mockMensaMenu = {
  main: 'Vegan Chili with fresh bread',
  side: 'Mixed Salad Bar & Fries',
  soup: 'Tomato & Basil',
};

// --- Custom Components ---

const LoadingIndicator = () => (
  <div className="flex items-center justify-center p-4">
    <svg className="animate-spin h-5 w-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span className="ml-3 text-sm text-gray-600">AI is thinking...</span>
  </div>
);

// --- CALENDAR VIEW COMPONENT (NEW) ---
const CalendarComponent = ({ deadlines, schedule }) => {
  const [view, setView] = useState('Month');
  const today = new Date().toDateString();

  // Filter and group events based on mock view for demo clarity
  const filteredEvents = view === 'Month'
    ? [...deadlines, ...schedule]
    : view === 'Week'
      ? [...deadlines, ...schedule].filter(e => {
          const eventDate = new Date(e.date || e.day); // Simplified date handling for demo
          const diffTime = eventDate - new Date();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= -7 && diffDays <= 7;
        })
      : [...deadlines, ...schedule].filter(e => new Date(e.date || e.date).toDateString() === today);

  // Group events by a simplified date for display
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const dateKey = event.date || event.day;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {});

  const viewOptions = ['Day', 'Week', 'Month'];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-teal-500">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h3 className="text-xl font-bold text-gray-700">Unified Calendar View</h3>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
          {viewOptions.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-sm font-semibold rounded-lg transition ${
                view === v ? 'bg-teal-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {Object.keys(groupedEvents).length > 0 ? (
          Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b)).map(dateKey => (
            <div key={dateKey} className="border-l-4 border-indigo-400 pl-4">
              <h4 className="font-extrabold text-lg text-gray-800 mb-2">{dateKey} {dateKey === today ? '(Today)' : ''}</h4>
              <ul className="space-y-3">
                {groupedEvents[dateKey].map(event => (
                  <li key={event.id} className={`p-3 rounded-lg flex justify-between items-center ${event.type === 'Assignment' || event.type === 'Exam' ? 'bg-red-50' : 'bg-indigo-50'}`}>
                    <div>
                      <p className="font-semibold text-gray-800">{event.title} <span className='text-xs font-normal text-gray-500'>({event.course || event.day})</span></p>
                      <p className="text-sm text-gray-600">
                        {event.time && <span className='font-bold text-teal-600'>{event.time} - </span>}
                        {event.type || 'Class/Event'}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${event.overlaps ? 'bg-red-300' : 'bg-teal-300'} text-gray-800`}>
                      {event.overlaps ? 'Conflict' : event.status || 'Scheduled'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-gray-500 italic text-center py-10">No events found for this view period.</p>
        )}
      </div>
    </div>
  );
};

// 1. Home/Calendar View
const HomeView = ({ studentName, deadlines, schedule, emailSummaries, mensaMenu }) => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-4 sm:p-8 space-y-8">
      {/* WELCOME BANNER (NEW) */}
      <div className="bg-teal-500 p-6 rounded-2xl shadow-xl text-white">
        <h2 className="text-3xl font-extrabold mb-1">
          Hi, {studentName}!
        </h2>
        <p className="text-lg font-semibold opacity-90">
          Today's schedule is below. {today}
        </p>
      </div>

      {/* Calendar Component Integration (NEW) */}
      <CalendarComponent deadlines={deadlines} schedule={schedule} />

      {/* Scrolling Down: Email Summaries and Mensa Menu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          <EmailSummary summaries={emailSummaries} />
          <MensaMenu menu={mensaMenu} />
      </div>
    </div>
  );
};

// 2. Email Summary Card
const EmailSummary = ({ summaries }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl border-l-4 border-indigo-400">
    <h3 className="text-xl font-bold text-gray-700 mb-3 flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-11 9h10a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      Important Email Summaries
    </h3>
    <ul className="space-y-3">
      {summaries.map((s) => (
        <li key={s.id} className="p-3 bg-indigo-50 rounded-lg">
          <p className="font-semibold text-sm text-gray-800">{s.from}</p>
          <p className="text-xs text-gray-600 italic mt-1">{s.summary}</p>
        </li>
      ))}
    </ul>
  </div>
);

// 3. Mensa Menu Card
const MensaMenu = ({ menu }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl border-l-4 border-green-400">
    <h3 className="text-xl font-bold text-gray-700 mb-3 flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c1.657 0 3 .895 3 2s-1.343 2-3 2h-3s-1.343 0-3-.895-3-2 3-2h3zm2-3H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2z" />
      </svg>
      Mensa Menu Today
    </h3>
    <ul className="space-y-2 text-base">
      <li className="text-gray-700"><span className="font-bold text-green-600">Main:</span> {menu.main}</li>
      <li className="text-gray-700"><span className="font-bold text-green-600">Side:</span> {menu.side}</li>
      <li className="text-gray-700"><span className="font-bold text-green-600">Soup:</span> {menu.soup}</li>
    </ul>
  </div>
);


// 4. Personal Goal Tracker View (Unchanged logic)
const GoalTracker = ({ userId }) => {
  const [goal, setGoal] = useState('Study Machine Learning');
  const [duration, setDuration] = useState('3 months');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generatePlan = async () => {
    if (!goal) return setError("Please specify a goal to plan.");
    console.log(`Goal set: ${goal}. Would save to Firestore path: /artifacts/${APP_ID}/users/${userId}/goals`);

    setLoading(true);
    setPlan(null);
    setError(null);

    const userQuery = `Create a detailed ${duration} study plan for the goal: "${goal}". Structure the plan monthly, detailing key focus areas and specific tasks for each month.`;
    const systemPrompt = "You are an expert educational planner. Given a user's learning goal and duration, generate a comprehensive study plan structured monthly. Focus on practical tasks and resources.";

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ "google_search": {} }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              "month": { "type": "INTEGER" },
              "focus": { "type": "STRING" },
              "tasks": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
              }
            },
            propertyOrdering: ["month", "focus", "tasks"]
          }
        }
      }
    };

    try {
      const apiUrl = `${GEMINI_API_URL_BASE}gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const contentText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (contentText) {
        const parsedPlan = JSON.parse(contentText);
        setPlan(parsedPlan);
        console.log(`Plan generated and would be saved to Firestore for user: ${userId}`);
      } else {
        setError("Could not generate a plan. Please try again.");
      }
    } catch (e) {
      console.error("Gemini API Error:", e);
      setError("Failed to connect to the planning agent.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-white rounded-2xl shadow-xl h-full">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-teal-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M10 16h.01" />
        </svg>
        Personal Goal Tracker
      </h2>
      <p className='text-gray-600 mb-6'>Let the AI generate a structured study plan for any certification or skill you want to pursue.</p>

      <div className="space-y-4 p-4 border rounded-xl bg-gray-50">
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g., Study for AWS Certification"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
        />
        <div className="flex space-x-4">
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="p-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 w-1/3"
          >
            <option value="1 month">1 Month</option>
            <option value="3 months">3 Months</option>
            <option value="6 months">6 Months</option>
          </select>
          <button
            onClick={generatePlan}
            disabled={loading}
            className="flex-1 bg-teal-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-teal-700 transition duration-150 disabled:bg-teal-300"
          >
            {loading ? 'Generating Plan...' : 'Generate AI Study Plan'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 mt-4">{error}</p>}
      {loading && <LoadingIndicator />}

      {plan && (
        <div className="mt-8 pt-4 space-y-6">
          <h3 className="text-xl font-bold text-teal-600 border-b pb-2">Your AI Plan for "{goal}"</h3>
          {plan.map((monthPlan) => (
            <div key={monthPlan.month} className="bg-white p-5 rounded-xl shadow-lg border border-teal-100">
              <h4 className="font-extrabold text-gray-800 text-lg">Month {monthPlan.month}: {monthPlan.focus}</h4>
              <ul className="list-none mt-3 space-y-2 text-base text-gray-700">
                {monthPlan.tasks.map((task, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-sm text-gray-500 italic">Progress on this plan would be tracked and saved in Firestore.</p>
        </div>
      )}
    </div>
  );
};

// 5. My Courses View (NEW)
const MyCoursesView = () => {
  const [selectedCourse, setSelectedCourse] = useState(mockCourseData[0]);

  const DetailCard = ({ title, content, icon }) => (
    <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
      <div className="flex items-center mb-2">
        {icon}
        <h4 className="font-bold text-gray-700 ml-2">{title}</h4>
      </div>
      <p className="text-gray-600 text-sm">{content}</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 bg-gray-50 rounded-2xl shadow-xl h-full flex flex-col lg:flex-row space-y-6 lg:space-y-0 lg:space-x-6">
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-lg border-l-4 border-indigo-500">
        <h2 className="text-2xl font-extrabold text-gray-800 mb-6 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.206 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.794 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.794 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.206 18 16.5 18s-3.332.477-4.5 1.253" />
          </svg>
          My Enrolled Courses
        </h2>
        <div className="space-y-3">
          {mockCourseData.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`w-full p-4 text-left rounded-xl transition duration-150 ${
                selectedCourse.id === course.id
                  ? 'bg-indigo-600 text-white shadow-lg font-bold'
                  : 'bg-indigo-50 text-gray-800 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <span className='text-sm font-light mr-2'>{course.id}</span>
              {course.title}
            </button>
          ))}
        </div>
      </div>

      {/* Course Details Panel */}
      <div className="w-full lg:w-2/3 bg-white p-6 rounded-2xl shadow-lg">
        <h3 className="text-3xl font-extrabold text-teal-600 mb-1">{selectedCourse.title}</h3>
        <p className="text-gray-500 mb-6 border-b pb-4">Instructor: {selectedCourse.instructor}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <DetailCard
            title="Venue & Time"
            content={`${selectedCourse.venue} | ${selectedCourse.schedule}`}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <DetailCard
            title="Exams & Grading"
            content={selectedCourse.exam}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M10 16h.01" /></svg>}
          />
        </div>

        <h4 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Moodle Content (Recent Uploads)</h4>
        <ul className="space-y-3 max-h-48 overflow-y-auto">
          {selectedCourse.moodle.map((item, index) => (
            <li key={index} className={`p-3 rounded-lg flex justify-between items-center ${item.type === 'Assignment' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border`}>
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${item.type === 'Assignment' ? 'bg-red-200 text-red-800' : 'bg-teal-200 text-teal-800'}`}>
                  {item.type}
                </span>
                <span className="font-semibold text-gray-800">{item.title}</span>
              </div>
              <span className="text-xs text-gray-500">Uploaded: {item.uploaded}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// 6. AI Chat and Prioritizer View (Unchanged)
const AIChat = () => {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
      { user: 'AI Agent', message: "Hello! I am your personalized UniBridge AI Agent. You can send a voice note (or type) to prioritize tasks, reschedule overlapping events, or customize your schedule." }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleChatSend = () => {
    if (chatInput.trim() === '') return;

    const userMessage = chatInput;
    const newHistory = [...chatHistory, { user: 'User', message: userMessage }];
    setChatHistory(newHistory);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let responseMessage;
      if (userMessage.toLowerCase().includes('prioritize') || userMessage.toLowerCase().includes('midterm')) {
        responseMessage = `Understood: "${userMessage}". I've reviewed your current schedule. I've successfully prioritized all tasks related to the Data Structures Midterm. I will send a mobile notification 2 days before the exam!`;
      } else if (userMessage.toLowerCase().includes('overlap') || userMessage.toLowerCase().includes('reschedule')) {
        responseMessage = `Acknowledged. I have checked the 'Team Meeting' overlap with your 'Focused Study Block' and secured an alternative time for the study block: 18:00 - 20:00 on Monday. Mobile notification sent.`;
      } else {
        responseMessage = `I've noted your request: "${userMessage}". I am applying this to your personal schedule and will notify you of any changes.`;
      }

      setChatHistory(prev => [...prev, {
        user: 'AI Agent',
        message: responseMessage
      }]);
      setIsTyping(false);
    }, 2000);
  };

  return (
    <div className="p-4 sm:p-8 bg-white rounded-2xl shadow-xl h-full flex flex-col">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-teal-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v0a7 7 0 01-7-7v0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v0" />
        </svg>
        AI Voice Chat & Prioritizer
      </h2>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 border-b pb-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex ${msg.user === 'User' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl shadow-md ${
              msg.user === 'User'
                ? 'bg-indigo-500 text-white rounded-br-none'
                : 'bg-teal-100 text-gray-800 rounded-tl-none'
            }`}>
              <p className="text-sm font-medium">{msg.message}</p>
            </div>
          </div>
        ))}
        {isTyping && (
             <div className="flex justify-start">
               <div className="bg-gray-100 text-gray-800 p-3 rounded-xl rounded-tl-none max-w-xs">
                 <LoadingIndicator />
               </div>
             </div>
           )}
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
          placeholder="Type or simulate a voice note for scheduling/prioritization..."
          className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-teal-500 focus:border-teal-500"
        />
        <button
          onClick={handleChatSend}
          disabled={isTyping}
          className="bg-teal-600 text-white p-3 rounded-full shadow-md hover:bg-teal-700 transition duration-150 disabled:bg-gray-400"
          title="Send / Simulate Voice Note"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// 7. Settings View (Unchanged)
const SettingsView = ({ db, userId }) => (
    <div className="p-4 sm:p-8 bg-white rounded-2xl shadow-xl h-full">
        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-teal-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Account Settings & Integration
        </h2>
        <p className="text-gray-600 mb-8">Manage account integrations and notification preferences. UniBridge unifies data from multiple platforms into one app.</p>

        <div className="space-y-6">
            <h3 className='text-xl font-bold text-indigo-600 border-b pb-2'>Data Unification & Connections</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['Moodle', 'Webmail', 'Personal Mail', 'Library'].map(platform => (
                    <div key={platform} className="p-4 border rounded-xl bg-gray-50 flex justify-between items-center">
                        <span className="font-semibold text-gray-800">{platform}</span>
                        <span className="text-sm font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">
                            Connected
                        </span>
                    </div>
                ))}
            </div>

            <h3 className='text-xl font-bold text-indigo-600 border-b pb-2 pt-4'>Backend Configuration</h3>
            <div className="p-4 bg-indigo-50 rounded-lg font-mono text-sm">
                <p>App ID: <span className="text-indigo-700 font-bold">{APP_ID}</span></p>
                <p>User ID: <span className="text-indigo-700 font-bold">{userId}</span></p>
                <p>DB Instance: <span className="text-indigo-700">{db?.name}</span></p>
                <p className='mt-2 text-xs text-gray-600'>Private Data Path Example: `/artifacts/{APP_ID}/users/{userId}/deadlines`</p>
            </div>
        </div>
        <p className="mt-8 text-sm text-red-500">*Note: Mobile Notifications for lectures/deadlines would be configured here in a live app.</p>
    </div>
);

// 8. Links View (Unchanged)
const LinksView = () => (
    <div className="p-4 sm:p-8 bg-white rounded-2xl shadow-xl h-full">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-teal-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.881L14.283 13.9a3 3 0 004.243 4.243l.893-.893M13.828 10.172L19 5" />
        </svg>
        External Quick Links
      </h2>
      <p className="text-gray-600 mb-8">Access your essential student portals directly.</p>
      <div className="space-y-4">
        {['Moodle', 'Webmail Login', 'Library Catalog', 'Student Portal'].map(platform => (
          <a
            key={platform}
            href="#" // Placeholder for actual link
            className="flex items-center justify-between p-5 bg-teal-50 rounded-xl border border-teal-200 hover:bg-teal-100 transition duration-150 shadow-sm"
          >
            <span className="font-semibold text-teal-700">{platform}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>
    </div>
);

// --- Main App Component ---

const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [data, setData] = useState({ deadlines: [], schedule: [] });
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    try {
      const firebaseApp = initializeApp(FIREBASE_CONFIG);
      const authInstance = getAuth(firebaseApp);
      const dbInstance = getFirestore(firebaseApp);

      setDb(dbInstance);
      setAuth(authInstance);

      onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          try {
            if (INITIAL_AUTH_TOKEN) {
              const result = await signInWithCustomToken(authInstance, INITIAL_AUTH_TOKEN);
              setUserId(result.user.uid);
            } else {
              const result = await signInAnonymously(authInstance);
              setUserId(result.user.uid);
            }
          } catch (e) {
            console.error("Auth failed, falling back to random ID:", e);
            setUserId(crypto.randomUUID());
          }
        }
      });
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setUserId('initial-error-id');
      setDb({ name: 'Error' });
      setAuth({ name: 'Error' });
    }
  }, []); // Run only once on mount

  // 2. Data Fetching (Simulated Real-Time with onSnapshot)
  useEffect(() => {
    if (db && userId) {
        const dataCollectionPath = collection(db, 'artifacts', APP_ID, 'users', userId, 'studentData');
        const q = query(dataCollectionPath);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // In a real app, we handle the array of documents, here we use mock data structure
            setData(snapshot.docs[0]);
        });

        return () => unsubscribe();
    }
  }, [db, userId]);


  const menuItems = [
    { name: 'Home/Calendar', view: 'home', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { name: 'My Courses', view: 'courses', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.206 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.794 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.794 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.206 18 16.5 18s-3.332.477-4.5 1.253" />
      </svg>
    )},
    { name: 'Personal Goal Tracker', view: 'goals', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M10 16h.01" />
      </svg>
    )},
    { name: 'AI Chat & Prioritizer', view: 'chat', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v0a7 7 0 01-7-7v0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v0" />
      </svg>
    )},
    { name: 'Account Settings', view: 'settings', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { name: 'External Links', view: 'links', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.881L14.283 13.9a3 3 0 004.243 4.243l.893-.893M13.828 10.172L19 5" />
      </svg>
    )},
  ];

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView studentName={MOCK_STUDENT_NAME} deadlines={data.deadlines} schedule={data.schedule} emailSummaries={mockEmailSummaries} mensaMenu={mockMensaMenu} />;
      case 'courses':
        return <MyCoursesView />;
      case 'goals':
        return <GoalTracker userId={userId} />;
      case 'chat':
        return <AIChat />;
      case 'settings':
        return <SettingsView db={db} userId={userId} />;
      case 'links':
        return <LinksView />;
      default:
        return <HomeView studentName={MOCK_STUDENT_NAME} deadlines={data.deadlines} schedule={data.schedule} emailSummaries={mockEmailSummaries} mensaMenu={mockMensaMenu} />;
    }
  };

  const navButtonClass = (view) => `flex items-center w-full px-4 py-3 rounded-lg font-semibold text-lg transition duration-200 ${
    currentView === view
      ? 'bg-teal-600 text-white shadow-lg'
      : 'text-gray-700 hover:bg-teal-50'
  }`;

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex text-gray-800">

      {/* Sidebar (Desktop) */}
      <aside className={`fixed z-20 md:static transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out w-64 bg-white shadow-2xl md:shadow-xl h-screen flex flex-col`}>
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-3xl font-black text-teal-700">Uni<span className="text-indigo-700">Bridge</span></h1>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.view}
              onClick={() => { setCurrentView(item.view); setIsSidebarOpen(false); }}
              className={navButtonClass(item.view)}
            >
              {item.icon}
              <span className='ml-4'>{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t text-xs text-gray-500">
          <p>User ID: {userId || 'Authenticating...'}</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full">
        {/* Mobile Header */}
        <header className="bg-white shadow-md p-4 sticky top-0 z-10 md:hidden flex justify-between items-center">
          <h1 className="text-2xl font-black text-teal-700">Uni<span className="text-indigo-700">Bridge</span></h1>
          <button
            className="p-2 text-gray-600 rounded-lg hover:bg-gray-100 transition"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isSidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </header>

        {/* Content View */}
        <div className="min-h-full">
            {renderView()}
        </div>
      </main>

      {/* Overlay for mobile view when sidebar is open */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black opacity-50 z-10 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}
    </div>
  );
};

export default App;
