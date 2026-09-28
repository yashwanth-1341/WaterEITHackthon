import io,sys,os
p='index.html'
s=io.open(p,encoding='utf-8').read()
if 'v-foresight' in s: print('already patched'); sys.exit(0)
sec=io.open('fs_sections.html',encoding='utf-8').read()
btn='''  <button data-view="foresight"><span class="n">8</span>Foresight</button>
  <button data-view="impact"><span class="n">9</span>Impact &amp; evidence</button>
</nav>'''
assert s.count('</nav>')==1 and s.count('</main>')==1 and s.count('css/app.css">')==1 and s.count('js/app.js"></script>')==1
s=s.replace('</nav>',btn,1)
s=s.replace('</main>',sec+'</main>',1)
s=s.replace('css/app.css">','css/app.css">\n<link rel="stylesheet" href="css/foresight.css">',1)
s=s.replace('js/app.js"></script>','js/app.js"></script>\n<script src="js/foresight.js"></script>',1)
io.open(p,'w',encoding='utf-8',newline='').write(s)
pass
print('patched')
