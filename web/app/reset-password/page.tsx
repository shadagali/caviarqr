"use client"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import axios from "axios"

export default function ResetPage(){

const params = useSearchParams()
const token = params.get("token")

const [password,setPassword] = useState("")
const [msg,setMsg] = useState("")

const save = async () => {
if(!password) return setMsg("Enter password")

try{
await axios.post("http://localhost:3001/business/reset-password",{
token,
password
})
setMsg("Password updated ✅")
}catch{
setMsg("Failed ❌")
}
}

return(
<div style={{padding:20}}>

<h1>Reset Password</h1>

<input
placeholder="new password"
value={password}
onChange={e=>setPassword(e.target.value)}
style={{display:"block",marginBottom:10}}
/>

<button onClick={save}>Save</button>

<p>{msg}</p>

</div>
)
}