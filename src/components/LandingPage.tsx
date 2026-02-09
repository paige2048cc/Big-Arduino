import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Menu, Home, Folder, BookOpen, Users, Settings, Zap, ChevronRight, ChevronDown, Send, MessageSquare, Heart, Share2 } from 'lucide-react';

interface LandingPageProps {
  onEnterProject: () => void;
}

export function LandingPage({ onEnterProject }: LandingPageProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'projects' | 'learn' | 'community'>('home');

  // Custom Colors
  const sunYellow = "#FFC425";
  const brandBlue = "#1e40af"; // blue-800 to match the logo/theme
  
  // Images
  const projectThumbUrl = "https://images.unsplash.com/photo-1559819615-9e8ae012d723?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcmR1aW5vJTIwY2lyY3VpdCUyMGJvYXJkJTIwcHJvamVjdCUyMHRodW1ibmFpbHxlbnwxfHx8fDE3NzAwMzk4Mjh8MA&ixlib=rb-4.1.0&q=80&w=1080";

  // --- Interaction Setup ---
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smooth spring animation for the mouse follower
  const springConfig = { damping: 25, stiffness: 120 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Common styles
  const iconButtonClass = "p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors";
  
  const getNavItemClass = (tabName: 'home' | 'projects' | 'learn' | 'community') => {
    const base = "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium w-full text-left cursor-pointer";
    return activeTab === tabName 
      ? `${base} bg-blue-50 text-blue-800` 
      : `${base} text-slate-600 hover:bg-slate-100 hover:text-blue-800`;
  };

  // --- Content Components ---

  const HomeContent = () => (
    <div className="max-w-6xl mx-auto space-y-10 relative z-10">
      {/* 
        Glass Effect "What will you create today?" Card 
      */}
      <section className="relative overflow-hidden rounded-2xl shadow-lg border border-white/60 bg-white/30 backdrop-blur-xl h-[400px] flex flex-col items-center justify-center transition-all hover:shadow-xl group/card">
        
        {/* Subtle internal gradient/shine for the glass card */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-white/20 pointer-events-none"></div>

        <div className="relative z-10 px-8 flex flex-col items-center text-center w-full max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-slate-900 drop-shadow-sm">
            What will you create today?
          </h1>
          <p className="text-slate-700 text-lg mb-10 max-w-2xl font-light">
            Describe your idea and our AI will help you plan the circuit, write the code, and simulate it instantly.
          </p>
          
          <div className="w-full max-w-xl relative group">
            {/* Input Glow */}
            <div className="absolute inset-0 bg-white/60 rounded-lg blur opacity-40 group-hover:opacity-60 transition-all duration-300"></div>
            
            {/* Glass Input Field */}
            <div className="relative bg-white/70 backdrop-blur-md rounded-lg shadow-sm flex items-center p-2 border border-white/60 focus-within:ring-2 focus-within:ring-blue-400/30 transition-all">
              <input 
                type="text" 
                placeholder="e.g., 'A plant watering reminder with LED indicators'"
                className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-slate-900 placeholder:text-slate-500 text-base font-medium"
              />
              <button className="p-3 hover:brightness-110 text-blue-950 rounded-md transition-all shadow-sm" style={{ backgroundColor: sunYellow }}>
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Featured Projects</h2>
          <button className="text-blue-700 font-medium hover:underline text-sm flex items-center gap-1">
            View All <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Active Card */}
          <div 
            onClick={onEnterProject}
            className="group bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-sm hover:shadow-lg border border-slate-200 transition-all cursor-pointer relative overflow-hidden ring-0 hover:ring-2 ring-blue-600/50"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap size={80} className="text-blue-700" />
            </div>
            
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
              <Zap size={24} fill="currentColor" />
            </div>
            
            <div className="mb-2">
              <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">
                Beginner
              </span>
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                LED Button Control
              </h3>
            </div>
            
            <p className="text-slate-500 text-sm mb-6 line-clamp-2">
              Learn the basics by controlling an LED with a pushbutton. Perfect for your first Arduino project.
            </p>
            
            <div className="flex items-center text-blue-700 font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Start Building <ChevronRight size={16} className="ml-1" />
            </div>
          </div>

          {/* Coming Soon Cards */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-slate-200 relative opacity-70">
            <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-md">Soon</div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600 mb-4">
              <div className="grid grid-cols-2 gap-1 w-6 h-6">
                  <div className="bg-current rounded-full opacity-50"></div>
                  <div className="bg-current rounded-full opacity-50"></div>
                  <div className="bg-current rounded-full opacity-50"></div>
                  <div className="bg-current rounded-full opacity-50"></div>
              </div>
            </div>
              <div className="mb-2">
              <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">Intermediate</span>
              <h3 className="text-xl font-bold text-slate-800">Traffic Light System</h3>
            </div>
            <p className="text-slate-500 text-sm">Build a realistic traffic light with timed sequences and state machines.</p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-slate-200 relative opacity-70">
              <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-md">Soon</div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600 mb-4">
                <Zap size={24} className="rotate-180" />
              </div>
              <div className="mb-2">
              <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">Advanced</span>
              <h3 className="text-xl font-bold text-slate-800">Smart Plant Monitor</h3>
            </div>
            <p className="text-slate-500 text-sm">Monitor soil moisture and get alerts when your plant needs water. IoT basics included.</p>
          </div>

        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="flex flex-wrap gap-3">
            {['Beginner', 'Intermediate', 'Advanced'].map((tag) => (
                <button key={tag} className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded-lg text-sm font-semibold text-slate-600 transition-all shadow-sm hover:shadow-md">
                    {tag}
                </button>
            ))}
        </div>
      </section>
    </div>
  );

  const ProjectsContent = () => (
    <div className="max-w-6xl mx-auto space-y-8 relative z-10">
      <div className="flex flex-col gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800">My Projects</h1>
        <p className="text-slate-500 max-w-2xl">Manage and continue working on your Arduino circuits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {[
            { title: 'Smart Home Hub', time: '2h ago', status: 'In Progress' },
            { title: 'LED Array Test', time: '1d ago', status: 'Completed' },
            { title: 'Servo Motor Control', time: '3d ago', status: 'In Progress' },
            { title: 'Weather Station v2', time: '1 week ago', status: 'Draft' },
            { title: 'Robot Arm Prototype', time: '2 weeks ago', status: 'Completed' },
          ].map((item, i) => (
            <div key={i} className="group bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all">
                <div className="h-40 overflow-hidden relative bg-slate-100">
                <img
                    src={projectThumbUrl}
                    alt="Project Workspace"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-blue-900/10 group-hover:bg-transparent transition-colors"></div>
                </div>
                <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 truncate">{item.title}</h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-slate-100 text-slate-500 rounded-md">{item.status}</span>
                </div>
                <p className="text-xs text-slate-400">Edited {item.time}</p>
                </div>
            </div>
          ))}

          {/* Create New Project Card */}
          <div className="bg-white/40 backdrop-blur-sm border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all cursor-pointer min-h-[250px]">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                  <Zap size={24} />
              </div>
              <span className="font-semibold">Create New Project</span>
          </div>
      </div>
    </div>
  );

  const LearnContent = () => (
    <div className="max-w-6xl mx-auto space-y-8 relative z-10">
      <div className="flex flex-col gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Learn Arduino</h1>
        <p className="text-slate-500 max-w-2xl">Master the basics of electronics and coding with our interactive guides.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'Arduino Basics', desc: 'Understanding pins, voltage, and current.', color: 'bg-blue-100 text-blue-600' },
          { title: 'C++ for Arduino', desc: 'Variables, loops, and functions explained.', color: 'bg-purple-100 text-purple-600' },
          { title: 'Components 101', desc: 'Deep dive into sensors and actuators.', color: 'bg-green-100 text-green-600' },
          { title: 'Circuit Design', desc: 'Best practices for schematic design.', color: 'bg-orange-100 text-orange-600' },
        ].map((item, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <BookOpen size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
            <p className="text-slate-500 text-sm">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const CommunityContent = () => (
    <div className="max-w-4xl mx-auto space-y-8 relative z-10">
      <div className="flex flex-col gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Community</h1>
        <p className="text-slate-500">Share your projects and ask questions.</p>
      </div>

      <div className="space-y-4">
         {[
           { user: 'Alice M.', title: 'Help with Servo Jitter', desc: 'My SG90 servo keeps jittering when I use the standard library...', likes: 24, comments: 5 },
           { user: 'Bob D.', title: 'My first weather station!', desc: 'Finally completed my ESP8266 weather station. Check out the photos!', likes: 156, comments: 42 },
           { user: 'Charlie', title: 'Best sensor for distance?', desc: 'Ultrasonic vs LiDAR for a small robot? Thoughts?', likes: 12, comments: 8 },
         ].map((post, i) => (
           <div key={i} className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 mb-3">
                   <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                      {post.user.charAt(0)}
                   </div>
                   <span className="text-sm font-semibold text-slate-700">{post.user}</span>
                   <span className="text-xs text-slate-400">• 2h ago</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 hover:text-blue-700">{post.title}</h3>
              <p className="text-slate-600 text-sm mb-4">{post.desc}</p>
              
              <div className="flex items-center gap-6 text-slate-500 text-sm">
                 <button className="flex items-center gap-2 hover:text-red-500 transition-colors">
                    <Heart size={16} /> <span>{post.likes}</span>
                 </button>
                 <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                    <MessageSquare size={16} /> <span>{post.comments}</span>
                 </button>
                 <button className="flex items-center gap-2 hover:text-slate-800 transition-colors">
                    <Share2 size={16} />
                 </button>
              </div>
           </div>
         ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <AnimatePresence mode='wait'>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full bg-white border-r border-slate-200 flex flex-col shrink-0 z-20"
          >
            {/* Sidebar Header with Hamburger */}
            <div className="p-4 flex items-center gap-3 border-b border-slate-100 h-16">
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2 font-bold text-xl text-blue-800">
                <Zap className="fill-blue-800" size={24} />
                <span>Big Arduino</span>
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-2">
              
              <button onClick={() => setActiveTab('home')} className={getNavItemClass('home')}>
                <Home size={20} />
                <span>Home</span>
              </button>

              <button onClick={() => setActiveTab('projects')} className={getNavItemClass('projects')}>
                <Folder size={20} />
                <span>Projects</span>
              </button>

              <button onClick={() => setActiveTab('learn')} className={getNavItemClass('learn')}>
                <BookOpen size={20} />
                <span>Learn</span>
              </button>
              <button onClick={() => setActiveTab('community')} className={getNavItemClass('community')}>
                <Users size={20} />
                <span>Community</span>
              </button>

            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-slate-100">
               <div className="flex items-center gap-3">
                  {/* User Profile */}
                  <div className="flex-1 flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer -ml-2">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-blue-900 font-bold text-xs shadow-sm border-2 border-white shrink-0"
                      style={{ backgroundColor: sunYellow }}
                    >
                      JD
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium truncate">John Doe</span>
                      <span className="text-xs text-slate-500 truncate">Free Plan</span>
                    </div>
                  </div>

                  {/* Settings Icon */}
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" title="Settings">
                     <Settings size={20} />
                  </button>
               </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* CSS GRADIENT BACKGROUND - Mimicking the soft mesh gradient of the picture */}
        <div className="absolute top-0 left-0 right-0 h-[800px] w-full z-0 overflow-hidden pointer-events-none bg-slate-50">
          
          {/* Yellow Blob - Animated */}
          <motion.div
            className="absolute top-[-100px] right-[10%] w-[600px] h-[600px] rounded-full opacity-40 blur-[100px]"
            style={{ backgroundColor: sunYellow }}
            animate={{
              x: [0, -50, 0],
              y: [0, 50, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Blue Blob - Animated (Using Brand Blue) */}
          <motion.div
            className="absolute top-[100px] left-[-100px] w-[700px] h-[700px] rounded-full opacity-30 blur-[120px]"
            style={{ backgroundColor: brandBlue }}
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Third mixed blob for blending - Lighter Blue */}
          <motion.div
             className="absolute top-[-200px] left-[30%] w-[800px] h-[600px] rounded-full opacity-20 blur-[100px] bg-blue-300"
             animate={{
                x: [0, 30, 0],
                y: [0, 20, 0],
             }}
             transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* INTERACTIVE MOUSE FOLLOWER BLOB */}
          <motion.div 
             className="absolute w-[500px] h-[500px] rounded-full bg-white opacity-40 blur-[80px] pointer-events-none mix-blend-overlay"
             style={{
                x: springX,
                y: springY,
                translateX: "-50%",
                translateY: "-50%"
             }}
          />

          {/* Fade mask to blend with the slate-50 background below */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-50/90"></div>
        </div>

        {/* Header */}
        <header className="h-16 bg-white/40 backdrop-blur-sm border-b border-white/20 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
             {!isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className={iconButtonClass}
                >
                  <Menu size={20} />
                </button>
             )}
             
             {!isSidebarOpen && (
               <div className="flex items-center gap-2 font-bold text-xl text-blue-800">
                 <Zap className="fill-blue-800" size={24} />
                 <span>Big Arduino</span>
               </div>
             )}
          </div>

          <div className="flex items-center gap-4"></div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/0 p-6 md:p-10 relative z-10">
           <AnimatePresence mode='wait'>
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
             >
                {activeTab === 'home' && <HomeContent />}
                {activeTab === 'projects' && <ProjectsContent />}
                {activeTab === 'learn' && <LearnContent />}
                {activeTab === 'community' && <CommunityContent />}
             </motion.div>
           </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
