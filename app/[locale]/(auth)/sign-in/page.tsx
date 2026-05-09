import { LoginComponent } from "./components/LoginComponent";
import { getGoogleClientId, isGoogleAuthEnabled } from "@/lib/env";

type SignInPageProps = {
  params: Promise<{ locale: string }>;
};

const SignInPage = async ({ params }: SignInPageProps) => {
  const { locale } = await params;
  const googleAuthEnabled = isGoogleAuthEnabled();
  const googleClientId = getGoogleClientId();

  return (
    <div className="h-full">
      <div className="py-10">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Welcome to Saily
        </h1>
      </div>
      <div>
        <LoginComponent
          locale={locale}
          googleAuthEnabled={googleAuthEnabled}
          googleClientId={googleClientId}
        />
      </div>
    </div>
  );
};

export default SignInPage;
