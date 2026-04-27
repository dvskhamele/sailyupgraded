import Link from "next/link";
import packageJson from "@/package.json";


const Footer = async () => {
  return (
    <footer className="flex flex-row h-8 justify-end items-center w-full text-xs text-muted-foreground p-5">
      <div className="hidden md:flex pr-5">
        <Link href="/crm/dashboard">
          <h1 className="text-muted-foreground hover:text-foreground transition-colors">
            Saily - v{packageJson.version}
          </h1>
        </Link>
      </div>
      <div className="hidden md:flex space-x-2 pr-2">
        <Link
          href="https://signimus.com"
          className="underline hover:text-foreground transition-colors"
        >
          signimus.com
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
