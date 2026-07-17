'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Listen for toggle events dispatched by TopBar's hamburger button
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('sgsSidebarToggle', handleToggle);
    return () => window.removeEventListener('sgsSidebarToggle', handleToggle);
  }, []);

  // Auto-close sidebar when route changes (mobile navigation)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const menuItems = [
    { name: 'Dashboard',            icon: '🏠', path: '/parent/dashboard' },
    { name: 'Assessments',          icon: '📝', path: '/parent/assessments' },
    { name: 'Assignments',          icon: '📄', path: '/parent/assignments' },
    { name: 'Quiz Performance',     icon: '📊', path: '/parent/quiz' },
    { name: 'Teacher Remarks',      icon: '💬', path: '/parent/remarks' },
    { name: 'Notices',              icon: '🔔', path: '/parent/notices' },
    { name: 'Communication Center', icon: '🏫', path: '/parent/communication' },
  ];

  return (
    <>
      {/* Mobile overlay — sits behind sidebar, above page content */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
          w-64 bg-slate-900/95 backdrop-blur-md text-white flex flex-col h-screen
          fixed left-0 top-0 overflow-y-auto z-40 border-r border-white/5
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src="/parent/logo.jpeg" alt="SGS-SWAIS" className="h-10 w-auto" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Parent Dashboard</p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-gray-400 hover:text-white transition-colors shrink-0"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-6">
          <ul className="space-y-2 px-4">
            {menuItems.map((item, index) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <li key={index}>
                  <Link
                    href={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-orange-600 text-white'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center text-slate-300 shadow-sm">
            <div className="flex justify-center mb-2">
              <span className="text-4xl">👨‍👩‍👦</span>
            </div>
            <p className="text-sm font-medium leading-tight">
              Stay connected with your child&apos;s learning journey.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
