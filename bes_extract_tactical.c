#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
int main(int argc,char**argv){
  FILE*f=fopen(argv[1],"rb"); long start=atol(argv[2]); int nslots=atoi(argv[3]); long ncases=atol(argv[4]);
  fseek(f,start,SEEK_SET);
  int want[]={111,266,10813,10814,12703,12704}; int nw=6;
  unsigned char cmd[8]; int ci=8; double bias=100.0;
  unsigned char row[8*16]; 
  printf("wt,vote,reason,preferred,pcon\n");
  for(long c=0;c<ncases;c++){
    double vals[6]; char str[17]; memset(str,0,17);
    for(int s=0;s<nslots;s++){
      if(ci==8){ if(fread(cmd,1,8,f)!=8) return 0; ci=0; }
      unsigned char k=cmd[ci++]; double v=NAN; unsigned char raw[8]; int israw=0;
      if(k==0){ s--; continue; }
      else if(k==252) return 0;
      else if(k==253){ fread(raw,1,8,f); israw=1; memcpy(&v,raw,8); }
      else if(k==254){ memset(raw,' ',8); israw=1; }
      else if(k==255){ v=NAN; }
      else { v=k-bias; double d=v; memcpy(raw,&d,8); }
      for(int w=0;w<nw;w++) if(want[w]==s){
        if(w<4) vals[w]=v;
        else { if(israw) memcpy(str+(w-4)*8,raw,8); else memset(str+(w-4)*8,' ',8); }
      }
    }
    for(int i=0;i<16;i++) if(str[i]==' ') str[i]=0;
    printf("%g,%g,%g,%g,%s\n",vals[0],vals[1],vals[2],vals[3],str);
  }
  return 0;
}
