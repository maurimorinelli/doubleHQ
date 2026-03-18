import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/insights', icon: 'auto_awesome', label: 'Insights' },
    { to: '/team', icon: 'group', label: 'Team' },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase()
        : '??';

    return (
        <aside className="w-16 md:w-20 bg-slate-900 flex flex-col items-center py-6 gap-8 border-r border-slate-800 shrink-0">
            <div className="size-10 bg-primary flex items-center justify-center rounded-xl mb-4">
                <span className="material-symbols-outlined text-white text-2xl">bubble_chart</span>
            </div>
            <nav className="flex flex-col gap-6 flex-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) =>
                            `p-3 rounded-xl flex items-center justify-center transition-colors ${isActive
                                ? 'bg-primary text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`
                        }
                    >
                        <span className="material-symbols-outlined">{item.icon}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="mt-auto flex flex-col gap-6">
                <NavLink
                    to="/clients/new"
                    title="New Client"
                    className={({ isActive }) =>
                        `p-3 rounded-xl flex items-center justify-center transition-colors ${isActive
                            ? 'bg-primary text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`
                    }
                >
                    <span className="material-symbols-outlined">add_circle</span>
                </NavLink>
                <button className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center" title="Settings">
                    <span className="material-symbols-outlined">settings</span>
                </button>
                <button
                    onClick={handleLogout}
                    className="p-3 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors flex items-center justify-center"
                    title="Log out"
                >
                    <span className="material-symbols-outlined">logout</span>
                </button>
                <div className="size-10 rounded-full border-2 border-slate-700 overflow-hidden" title={user?.name || ''}>
                    <div className="w-full h-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white">
                        {initials}
                    </div>
                </div>
            </div>
        </aside>
    );
}

