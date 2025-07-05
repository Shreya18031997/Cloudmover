import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";

export function Navbar() {
  const location = useLocation();
  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Face Matcher", path: "/face-matcher" },
  ];

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">CloudMover</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Button
                key={item.path}
                asChild
                variant={location.pathname === item.path ? "secondary" : "ghost"}
              >
                <Link to={item.path}>{item.name}</Link>
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`${process.env.REACT_APP_API_BASE_URL}/auth/source`}>
              Connect Source
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href={`${process.env.REACT_APP_API_BASE_URL}/auth/destination`}>
              Connect Destination
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
