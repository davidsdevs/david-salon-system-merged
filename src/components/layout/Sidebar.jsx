import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar, menuItems, bottomItems }) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-50
          transition-transform duration-300 ease-in-out
          w-64 md:translate-x-0 flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 md:hidden flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">DS</span>
            </div>
            <span className="font-semibold text-gray-900">DSMS</span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item, index) => (
            <div key={index}>
              {item.section && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {item.section}
                </div>
              )}
              {item.path && (
                <NavLink
                  to={item.path}
                  end={item.path.endsWith('/settings') || item.label === 'Dashboard'}
                  onClick={toggleSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white font-medium shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {item.icon && <item.icon className="w-5 h-5" />}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom Items (Notifications, etc.) */}
        {bottomItems && bottomItems.length > 0 && (
          <div className="border-t border-gray-200 p-4 flex-shrink-0">
            {bottomItems.map((item, index) => (
              <NavLink
                key={index}
                to={item.path}
                onClick={toggleSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white font-medium shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                {item.icon && <item.icon className="w-5 h-5" />}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
