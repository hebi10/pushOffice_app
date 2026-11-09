#!/usr/bin/env python3
"""Audit approved LiteRT model files on Hugging Face; never print signed links."""
import argparse, hashlib, json, pathlib, re, urllib.error, urllib.parse, urllib.request

MODELS = {
 "qwen3-06": ("litert-community/Qwen3-0.6B","Qwen3-0.6B.litertlm",614_000_000,"c5f39b4191926786c3e6668b62af4d6eb15248dfc7a5348252a9b406f33f2108"),
 "qwen35-08": ("litert-community/Qwen3.5-0.8B","Qwen3.5-0.8B_int8.litertlm",964_657_152,"d6702088983b3a997db5299558a37d2fd924a94daf2b09bd42c4e618c6f694a4"),
 "qwen35-2": ("litert-community/Qwen3.5-2B","Qwen3.5-2B_int8.litertlm",2_119_843_840,"c2438cb9c050220e667366b4beeca4daac56e693b226420674f53fc40f007c49"),
 "gemma4-e2b": ("litert-community/gemma-4-E2B-it-litert-lm","gemma-4-E2B-it.litertlm",2_590_000_000,"181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c")
}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self, request, fp, code, msg, headers, url):
  return None

def metadata():
 opener=urllib.request.build_opener(NoRedirect)
 evidence=[]
 for id,(repo,name,approx,expected) in MODELS.items():
  request=urllib.request.Request("https://huggingface.co/"+repo+"/resolve/main/"+name,method="HEAD",headers={"User-Agent":"PushOffice-public-model-audit"})
  try:
   res=opener.open(request,timeout=45)
  except urllib.error.HTTPError as error:
   if error.code not in (301,302,303,307,308): raise
   res=error
  with res:
   sha=(res.headers.get("X-Linked-Etag") or "").strip('"').lower()
   size=int(res.headers.get("X-Linked-Size") or "0")
   redirect=res.headers.get("Location","")
  assert re.fullmatch(r"[a-f0-9]{64}",sha),id+": missing HF SHA256"
  assert int(approx*0.9)<=size<=int(approx*1.1),id+": wrong file size"
  if expected: assert sha==expected,id+": upstream pinned digest changed"
  host=urllib.parse.urlparse(redirect).hostname or ""
  assert not host or host.endswith((".hf.co",".huggingface.co")),id+": unexpected redirect host"
  evidence.append({"id":id,"repo":repo,"filename":name,"size":size,"sha256":sha,"pinned":expected,"result":"verified"})
  print(id+" SHA256="+sha+" size="+str(size),flush=True)
 pathlib.Path("model-head-evidence.json").write_text(json.dumps(evidence,indent=2),encoding="utf-8")

def digest(id,path):
 assert id in MODELS,"unapproved model id"
 file=pathlib.Path(path)
 assert file.is_file() and file.name==MODELS[id][1],"unexpected path"
 ev=next(x for x in json.loads(pathlib.Path("model-head-evidence.json").read_text(encoding="utf-8")) if x["id"]==id)
 assert file.stat().st_size==ev["size"],"byte size mismatch"
 h=hashlib.sha256()
 with file.open("rb") as f:
  for chunk in iter(lambda:f.read(8*1024*1024),b""): h.update(chunk)
 actual=h.hexdigest()
 assert actual==ev["sha256"],"full-file checksum mismatch"
 print("ACTUAL FULL FILE VALIDATED:",id,"bytes",file.stat().st_size,"sha256",actual,flush=True)
 pathlib.Path("model-full-sha.json").write_text(json.dumps({"id":id,"size":file.stat().st_size,"sha256":actual,"verified":True},indent=2),encoding="utf-8")

if __name__=="__main__":
 p=argparse.ArgumentParser()
 p.add_argument("mode",choices=("metadata","digest"))
 p.add_argument("model",nargs="?")
 p.add_argument("file",nargs="?")
 a=p.parse_args()
 metadata() if a.mode=="metadata" else digest(a.model,a.file)
