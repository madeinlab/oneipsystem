%.o: %.c
	$(CC) $(CPPFLAGS) $(CFLAGS) $(FPIC) -DNDEBUG -c -o $@ $<

contrib/lemon: contrib/lemon.c contrib/lempar.c
	cc -o contrib/lemon $<

plural_formula.c: plural_formula.y contrib/lemon
	./contrib/lemon -q $<

template_lmo.c: plural_formula.c

clean:
	rm -f contrib/lemon po2lmo parser.so version.lua plural_formula.c plural_formula.h *.o

jsmin: jsmin.o
	$(CC) $(LDFLAGS) -o $@ $^

po2lmo: po2lmo.o template_lmo.o plural_formula.o
	$(CC) $(LDFLAGS) -o $@ $^

parser.so: template_parser.o template_utils.o template_lmo.o template_lualib.o plural_formula.o
	$(CC) $(LDFLAGS) -shared -o $@ $^

version.lua:
	chmod +x ./mkversion.sh
	./mkversion.sh $@ $(LUCI_VERSION) "$(LUCI_GITBRANCH)"

compile: parser.so version.lua

install: compile
	mkdir -p $(DESTDIR)/usr/lib/lua/luci/template
	cp parser.so $(DESTDIR)/usr/lib/lua/luci/template/parser.so
	cp version.lua $(DESTDIR)/usr/lib/lua/luci/version.lua
