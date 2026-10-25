import struct,sys,json
f=open(sys.argv[1],'rb'); h=f.read(176)
I=lambda: struct.unpack('<i',f.read(4))[0]
slots=[]; longn={}; vlab={}; slot=0
while True:
    rt=I()
    if rt==2:
        typ,hl,nm,pf,wf=struct.unpack('<5i',f.read(20)); name=f.read(8).decode('latin1').strip()
        if hl: L=I(); f.read((L+3)//4*4)
        if nm: f.read(abs(nm)*8)
        slots.append((name,typ)); slot+=1
    elif rt==3:
        n=I(); labs=[]
        for _ in range(n):
            v=f.read(8); L=f.read(1)[0]; t=f.read(((L+1+7)//8)*8-1)[:L].decode('latin1','replace'); labs.append((struct.unpack('<d',v)[0],t))
        assert I()==4; n=I(); idx=struct.unpack('<%di'%n,f.read(4*n))
        for i in idx: vlab[i-1]=labs
    elif rt==6: n=I(); f.read(80*n)
    elif rt==7:
        sub,size,cnt=struct.unpack('<3i',f.read(12)); d=f.read(size*cnt)
        if sub==13:
            for kv in d.decode('latin1').split('\t'):
                if '=' in kv: k,v=kv.split('=',1); longn[k]=v
    elif rt==999: I(); break
want=sys.argv[2].split(','); out={}
for i,(n,t) in enumerate(slots):
    ln=longn.get(n,n)
    if ln in want: out[ln]={'slot':i,'type':t,'labels':{str(k):v for k,v in vlab.get(i,[])}}
out['_datastart']=f.tell(); out['_nslots']=len(slots)
json.dump(out,open(sys.argv[3],'w'),indent=1)
for k,v in out.items():
    if not k.startswith('_'): print(k,v['slot'],v['type'],list(v['labels'].items())[:20])
print('data starts',out['_datastart'],'slots',len(slots))
