export class RequestError extends Error{constructor(message:string,public code:string,public status:number){super(message);}}
export async function apiRequest<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal});
 let result;try{result=await response.json();}catch{throw new RequestError('서버 연결을 확인하고 다시 시도해주세요.','INVALID_RESPONSE',response.status);}
 if(!response.ok){const error=result&&typeof result==='object'?result as {error?:unknown;code?:unknown}:{};throw new RequestError(typeof error.error==='string'?error.error:'요청을 처리하지 못했어요.',typeof error.code==='string'?error.code:'REQUEST_ERROR',response.status);}
 return result as T;
}
