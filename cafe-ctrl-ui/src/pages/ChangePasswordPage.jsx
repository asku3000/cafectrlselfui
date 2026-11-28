import React, { useState } from "react";
import AsyncForm, { SubmitButton } from "../components/async/AsyncForm";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [current_password, setCurrent] = useState("");
  const [new_password, setNew] = useState("");
  const submit = async () => {
    await api.post("/auth/change-password", { current_password, new_password });
    toast.success("Password changed");
    navigate(-1);
  };
  return (
    <div className="max-w-md mx-auto" data-testid="change-pw-root">
      <Card>
        <CardHeader><CardTitle className="font-display">Change password</CardTitle></CardHeader>
        <CardContent>
          <AsyncForm onSubmit={submit} className="space-y-4">
            <div><Label>Current Password</Label><Input type="password" value={current_password} onChange={e => setCurrent(e.target.value)} required data-testid="pw-current"/></div>
            <div><Label>New Password</Label><Input type="password" value={new_password} onChange={e => setNew(e.target.value)} required data-testid="pw-new" minLength={6}/></div>
            <SubmitButton data-testid="pw-submit">Update</SubmitButton>
          </AsyncForm>
        </CardContent>
      </Card>
    </div>
  );
}
