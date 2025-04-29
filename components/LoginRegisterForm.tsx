// components/LoginRegisterForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function LoginRegisterForm() {
  const [activeTab, setActiveTab] = useState("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoading(true);
    try {
      // CORREÇÃO: Passar username e password como um objeto, conforme esperado pelo AuthContext
      await login({ username: loginUsername, password: loginPassword });
      router.push("/");
    } catch (error: any) {
      setLoginError(error.message || "Login failed.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterSuccess("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: registerUsername, email: registerEmail, password: registerPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setRegisterSuccess(data.message || "Usuário registrado com sucesso! Por favor, confirme seu e-mail.");

    } catch (error: any) {
      setRegisterError(error.message || "Registration failed.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Login</TabsTrigger>
        <TabsTrigger value="register">Register</TabsTrigger>
      </TabsList>
      <TabsContent value="login">
        <Card className={cn("bg-gray-800 text-white border-gray-700")}>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>
              Enter your username and password to access your account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="loginUsername">Username</Label>
                <Input id="loginUsername" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required className={cn("bg-gray-700 border-gray-600 text-white focus:border-blue-500")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="loginPassword">Password</Label>
                <Input id="loginPassword" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className={cn("bg-gray-700 border-gray-600 text-white focus:border-blue-500")} />
              </div>
              {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" className={cn("w-full bg-blue-600 hover:bg-blue-700 text-white")} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </TabsContent>
      <TabsContent value="register">
        <Card className={cn("bg-gray-800 text-white border-gray-700")}>
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>
              Create a new account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="registerUsername">Username</Label>
                <Input id="registerUsername" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} required className={cn("bg-gray-700 border-gray-600 text-white focus:border-blue-500")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="registerEmail">Email</Label>
                <Input id="registerEmail" type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required className={cn("bg-gray-700 border-gray-600 text-white focus:border-blue-500")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="registerPassword">Password</Label>
                <Input id="registerPassword" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required className={cn("bg-gray-700 border-gray-600 text-white focus:border-blue-500")} />
              </div>
              {registerError && <p className="text-red-500 text-sm">{registerError}</p>}
              {registerSuccess && <p className="text-green-500 text-sm">{registerSuccess}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" className={cn("w-full bg-green-600 hover:bg-green-700 text-white")} disabled={isLoading}>
                 {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Register
              </Button>
            </CardFooter>
          </form>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
