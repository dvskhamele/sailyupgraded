import { LoginComponent } from "./components/LoginComponent";
import { isGoogleAuthEnabled } from "@/lib/env";

const SignInPage = async () => {
  const googleAuthEnabled = isGoogleAuthEnabled();

  return (
    <div className="h-full">
      <div className="py-10">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Welcome to Saily
        </h1>
      </div>
      <div>
        <LoginComponent googleAuthEnabled={googleAuthEnabled} />
      </div>
    </div>
  );
};

export default SignInPage;
