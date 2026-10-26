export default function Navbar() {
  const links = [
    { label: 'Our Features', href: '#features' },
    { label: 'Know More', href: '#info' },
    { label: 'Predict', href: '#predict' },
    { label: 'Survivor Stories', href: '#stories' },
  ];

  return (
    <nav className="navbar">
      <ul className="navbar__links">
        {links.map((link) => (
          <li key={link.href}>
            <a className="navbar__link" href={link.href}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
