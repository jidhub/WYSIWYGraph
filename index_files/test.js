/* TODO: 
	directed
	curvature
*/
const totable = (x) => "<tr>"+x.map(y => "<td>"+y.join("</td><td>")+"</td>").join("</tr><tr>")+"</tr>"; // données -> html
const info = `<table>
<tr><th>target</th><th>event</th><th>effect</th></tr>
`+totable([
["nodes", "ctrl left click", "delete"],
["nodes", "shift left click", "modify text (parsed in markdown)"],
["nodes", "left drag", "move"],
["nodes", "right drag", "link to another node"],
["nodes", "ctrl right drag", "make child of another node/unchild if target is self"],
["nodes", "ctrl alt left click", "toggle visibility"],
["nodes", "ctrl alt right click", "toggle static position"],
["nodes", "alt left click", "reduce size"],
["nodes", "alt right click", "augment size"],
["links", "ctrl left click", "delete"],
["links", "shift drag", "give one end an offset from the node"],
["links", "alt click", "reverse arrow direction (in directed graphs)"],
["background", "right click", "create a node"],
["-", "+", "augment scale"],
["-", "-", "reduce scale"],
["-", "o", "open file**"],
["-", "s", "save file**"],
["-", "c", "reduce computing delay"],
["-", "C", "augment computing delay"],
["-", "f", "reduce force power"],
["-", "F", "augment force power"],
["-", "d", "toggle if the graph is directed"],
["-", "space", "play/pause"],
["-", "1", "toggle display of forces*"],
["-", "2", "toggle bounds/wrapping"],
["-", "3", "toggle all same radius"],
["-", "4", "toggle center force"],
["-", "e", "edit the markdown code**"],
["-", "r", "update size"],
["-", "h", "get this message"],
])+`</table>
*The collision zones are shown in blue for normal nodes, green for child nodes, and red for static nodes, and links are shown black if stable, green if compressed, and red if streched.<br/>
**Markdown format of a file (in <a href="https://en.wikipedia.org/wiki/EBNF">EBNF</a>):<br/>
<blockquote><code>
<i>number</i> = { "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" };<br>
<i>index</i> = <i>number</i>;<br>
<i>key</i> = "x" | "y" | "vx" | "vy" | "sx" | "sy" | "dx" | "dy" | "tx" | "size" | "dir" | "dx1" | "dy1" | "dx2" | "dy2";<br>
<i>bool</i> = "true" | "false";<br>
<i>quote</i> = "\\"";<br>
<i>escaped string</i> = <i>quote</i> { ( . - <i>quote</i> ) } { <i>quote</i> <i>quote</i> { (. - <i>quote</i> ) } } <i>quote</i>; (* to allow for any character in texts *)<br>
<i>value</i> = <i>number</i> | <i>escaped string</i> | <i>bool</i>;<br>
<i>property list</i> = { <i>key</i> } " " { <i>value</i> } "\\n";<br>
<i>node description</i> = "# " <i>index</i> "\\n" [ "([p](#" <i>index</i> ")," ] <i>property list</i>;<br>
<i>link description</i> = "[s](#" <i>index</i> "),[t](#" <i>index</i> ")," <i>property list</i>;<br>
<i>file</i> = <i>property list</i> (* the settings of the simulation *) { <i>node description</i> } { <i>link description</i> };
</code></blockquote>`;
window.onload = () => { parse(markdowncontainer.innerHTML.slice(5, -4)) };
const body = d3.select('body');
const svg = body
	.append('svg')
	.on('contextmenu', (e) => { e.preventDefault(); }) // pour utiliser clic droit
const svge = svg._groups[0][0]; // the actual svg element
var scale = 2;
var forcepower = 1;
var width, height;
var running = true; // simulation devrait avancer (modulo divers choses qui l'arrêtent)
var wrap = false; // en fait plus rebondir que wrap
var debug = false;
var asr = false; // all same radius
var center = true; // si on met center force
var directed = true;
var fileurl = null;
var dragasource = null; // source de la flèche de drag
const p = (e) => e.preventDefault(); // makes for a lot of repetition, but must only prevent if match, else all other (e.g. browse) events fail
const mods = (a) => { // pour faire les modifieurs plus vite
	a = a.map(x => typeof(x) == "number"?(x+1)%3:x);
	let mo = ["shift", "ctrl", "alt"];
	return (e) => {
		for (let i=0;i<3;i++) {
			if (a[i] && ( ( typeof(a[i]) == "number" && a[i] != e[mo[i]+"Key"] + 1 ) || ( typeof(a[i]) == "string" && ( e[mo[i]+"Key"] && Number(a[i]) != e.buttons ) ) ) ) 
				return false;
		}
		return true;
	}
}
const rppp = (elem) => { // RePosition PoPup
	if (!elem) return;
	let div = d3.select("#"+elem.id);
	let r = div.node().getBoundingClientRect();
	div.style("height", Math.min(Math.max(r.height, height/8), height-100)+"px")
		.style("width", Math.min(Math.max(r.width, width/8), width-100)+"px");
	r = div.node().getBoundingClientRect();
	div.style("inset", "calc(50% - "+r.height/2+"px) calc(50% - "+r.width/2+"px)" );
}
const makepopup = (id) => { // crée un popup avec l'id id
	if (document.getElementById(id)) {
		return d3.select("#element-that-does-not-exist"+getrandomstring(50)) // moyen pratique de ne rien faire, on va append à rien
	} else {
		let div = body.append("div").attr("id", id).attr("class", "popup");
		let obs = new MutationObserver( (m) => rppp(m[0].target) ); // redo when it changes
		obs.observe(div.node(), { subtree : true, childList : true });
		return div
	}
}
const mthc = new showdown.Converter({simpleLineBreaks : true, headerLevelStart : 3,}); // Markdown To Html Converter
const pmth = (x) => mthc.makeHtml(x.tx||""); // Parse Markdown To Html
const getlast = (a) => a[a.length-1];
let getrandomstring = (len) => {
	let res = "";
	let s = "abcdefghijklmnopqrstuvwxyz-0123456789_";
	for (let i=0;i<len;i++) {
		res += s[Math.floor(Math.random()*s.length)];
	}
	return res
}
let getseconds = () => Math.floor(Date.now()/1000); // (since epoch)
let getelemname = () => "wysiwyg-graph_editor-markdown_container-random_string-" + getrandomstring(70) + "_and-" + getseconds() + "_seconds-since_epoch"; // good chance to not be closed inside
let elemname = /wysiwyg-graph_editor-markdown_container-random_string-[a-z0-9\-\._]{70}_and-\d*_seconds-since_epoch/;
const start = () => {
	running = true;
	force.restart();
	redo();
}
const restart = () => {
	if (running) {
		force.restart();
	}
	redo();
}
const stop = () => {
	running = false;
	force.stop();
}
const resize = (x=window.innerWidth, y=window.innerHeight, dobody=true) => { // resizes the svg to fit the window
	svg.attr("width", width=x).attr("height", height=y);
	if (dobody) body.style("height", height+"px").style("width", width+"px");
	d3.select(".popup").call((n) => rppp(n.node())); // update the popups to not overflow, as a sticky overflow looks very bad
	window.scroll(0, 0);
	redo();
}
const w = (c, d=false) => { dim = d?height:width; return c = (wrap)?((c+dim)%dim):Math.min(Math.max(c, 0), dim) }; // Wrap
const nodedata = [];
const linkdata = [];
const gethelp = () => { // make the help popup
	let hedi = makepopup("helpdiv");
	hedi.html(info);
	hedi.append("input").attr("type", "button").attr("class", "done").attr("value", "Close")
		.attr("onclick", "helpdiv.remove()");
}
body.append("div").attr("id", "helpbtn").html("?").append("div").attr("id", "helpcircle");
helpbtn.onclick = gethelp;
let defs = svg.append('defs');
defs.append('svg:marker') // définition des bouts de flèches
		.attr('id', 'end-arrow')
		.attr('refX', 8)
	.append('svg:path')
		.attr('d', 'M0,-5L10,0L0,5')
		.attr('fill', '#000');
defs.append('svg:marker')
		.attr('id', 'start-arrow')
		.attr('refX', 2)
	.append('svg:path')
		.attr('d', 'M10,-5L0,0L10,5')
		.attr('fill', '#000');
defs.append('svg:marker')
		.attr('id', 'drag-arrow')
		.attr('refX', 8)
	.append('svg:path')
		.attr('id', 'dragpath')
		.attr('d', 'M0,-5L10,0L0,5');
svg.selectAll("marker")
		.attr('viewBox', '0 -5 10 10')
		.attr('orient', 'auto')
		.attr("markerWidth", 7)
		.attr("markerHeight", 7);
style = body.append("style")
	.html(`
html { background : lightgray; font-family : sans; }
body { margin : 0; background : white }
#markdowncontainer { display : none }
.popup {
	position : sticky;
	background-color : #EEEEEE;
	width : fit-content;
	height : fit-content;
	border : 5px solid gray;
	border-radius: 10px;
	overflow: scroll;
}
td {
	padding : 5px;
	text-align : center;
}
.draga { marker-end : url(#drag-arrow) }
.valid { background : #4F4 }
.cancel { background : #F44 }
.reload { background : #44F }
.done { background : #DDDDDD }
.valid, .cancel {
	width : 50%;
	height : calc(50% - 20px);
}
input {
	font-size : 30px;
}
foreignObject {
	font-weight:bold;
	font-family : sans;
	width : 100%;
	height : 100%;
	pointer-events : none;
}
foreignObject > * {
	pointer-events : visible;
	width : fit-content;
}
#textinp { 
	height : calc(50% - 10px);
}
#mdinp {
	height : calc(90% - 10px);
}
textarea {
	width : calc(100% - 20px);
	border : none;
	font-family : monospace;
	resize : none;
	font-size : 20px;
	padding : 0;
	margin : 10px;
	border-radius : 10px;
}
#fileinp { height : calc(50% + 10px) }
#helpcircle {
	background : blue;
	border : 20px solid blue;
	border-radius : 60px;
	aspect-ratio : 1;
	position : absolute;
	left : 0;
	top : 0;
	z-index: -1;
}
#helpbtn {
	z-index: 1;
	width : 40px;
	height : 40px;
	color : white;
	position : sticky;
	text-align : center;
	font-size : 35px;
	bottom : 20px;
	left : 20px;
}
#helpdiv > input {
	width : 100%;
}
#mddiv {
	float : left;
	width : 50%;
	height : 100%;
	background : #CCC;
}
#mddiv > input {
	width : calc(100% / 3);
	height : calc(10% - 10px);
}
`);
const randomcolor = () => { // (en hexa)
	return ("#" + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, "0"))
}
var links = svg.append("g")	.selectAll('line').data(linkdata).enter().append('line'); // ensemble des arretes
var nodes = svg.append("g").selectAll('circle').data(nodedata).enter().append('circle');// ensemble des noeuds
var labels = svg.append("g").selectAll('foreignObject').data(nodedata).enter().append('foreignObject'); // ensemble des étiquettes
let minu = 0.01; // déplacement minimal
const tick = () => { // updates HTML coordinates (also some data manipulation)
	nodes._groups[0].forEach(e => { let n = e.__data__;
		let f = n.sx?[n.sx, n.sy]:(n.parent?([n.parent.x+n.dx, n.parent.y+n.dy]):[n.x, n.y]); // prochaines coordonnées
		n.ux = Math.abs(f[0] - n.ox); // diférences de coordonnées
		n.uy = Math.abs(f[1] - n.oy);
		n.ox = n.x; // update old coords
		n.oy = n.y;
		if (n.ux > minu) e.setAttribute("cx", n.x = w(f[0])); // redisplay only if moved enough; same for the rest
		if (n.uy > minu) e.setAttribute("cy", n.y = w(f[1], 1)); } );
	labels._groups[0].forEach(e => { let n = e.__data__;
		if (n.ux > minu) e.setAttribute("x", n.x+((n.size || 8)+2)*scale);
		if (n.uy > minu) e.setAttribute("y", n.y); });
	links._groups[0].forEach(e => { let l = e.__data__;
		if (l.u || l.source.ux > minu) e.setAttribute("x1", (l.source.x = w(l.source.x))+(l.dx1||0));
		if (l.u || l.source.uy > minu) e.setAttribute("y1", (l.source.y = w(l.source.y))+(l.dy1||0));
		if (l.u || l.target.ux > minu) e.setAttribute("x2", (l.target.x = w(l.target.x))+(l.dx2||0));
		if (l.u || l.target.uy > minu) e.setAttribute("y2", (l.target.y = w(l.target.y))+(l.dy2||0));
		if (debug && (l.u || Math.max(l.source.ux + l.source.uy + l.target.ux + l.target.uy) > minu)) { // coloration des arrêtes
		e.setAttribute("stroke", (() => {
		let qlen = Math.sqrt((l.source.x - l.target.x)**2 + (l.source.y - l.target.y)**2) / (((l.dir?l.source:l.target).size||8)*8*scale); // quot entre longueur théorique et pratique
		if (Math.abs(qlen - 1) < minu) {
			return "#000"
		} else if (qlen < 1) {
			return "#4F4"
		} else {
			return "#F44"
		} }) () ) }
		if (l.u) delete l.u; // stop forcing display once it's done
		} );
	if (dragasource) {
		d3.select(".draga")
			.attr("x1", w(dragasource.x))
			.attr("y1", w(dragasource.y));
	}
}
const dragnode = d3.drag() // forcé de faire une seule fonction de drag par élément
	.filter( mods([0, "2", 0])) // on laisse possibilité de ctrl right, pour désigner un parent
	.on('start', (ev, e) => {
		force.stop();
		if (ev.sourceEvent.buttons != 2) { // pas clic droit
			if (e.parent) { // child node
				e.dx = ev.x - e.parent.x;
				e.dy = ev.y - e.parent.y;
			} else if (e.sx) { // static node
				e.sx = ev.x;
				e.sy = ev.y;
			} else { // other node
				e.x = ev.x;
				e.y = ev.y;
			}
			tick();
		} else {
			let color = ev.sourceEvent.ctrlKey?"gray":"black"; // childing or linking
			d3.select("#dragpath").attr("fill", color);
			svg.append("line")
			.attr("stroke-width", 2*scale)
			.attr("stroke", color)
			.attr("x1", e.x)
			.attr("y1", e.y)
			.attr("x2", e.x)
			.attr("y2", e.y)
			.attr("class", "draga");
			dragasource = e;
		}
	})
	.on('drag', (ev, e) => {
		if (ev.sourceEvent.buttons != 2) {
			if (e.parent) {
				e.dx = ev.x - e.parent.x;
				e.dy = ev.y - e.parent.y;
			} else if (e.sx) {
				e.sx = ev.x;
				e.sy = ev.y;
			} else {
				e.x = ev.x;
				e.y = ev.y;
			}
			tick();
		} else {
			d3.select(".draga")
			.attr("x2", ev.x)
			.attr("y2", ev.y)
			.attr("x1", e.x)
			.attr("y1", e.y);
		}
	})
	.on('end', (ev, e) => {
		if (dragasource) {
			let target = ev.sourceEvent.target;
			if (target.__data__ && target.nodeName == "circle") { // si on a fini le drag sur un cercle
				if (d3.select("#dragpath").attr("fill").slice(4)) { // black not gray, so linking
					let link = { 
						source : e,
						target : target.__data__,
						index : linkdata.length,
						u : true,
					};
					if (e != target.__data__ && !linkdata.some(x => x.source == e && x.target == target.__data__)) // arrête pas déjà existante
						addlink(link);
				} else {
					if (e != target.__data__) { // make child
						e.parent = target.__data__;
						e.dx = e.x - e.parent.x;
						e.dy = e.y - e.parent.y;
						removestatic(e);
					} else { // unchild
						removeparent(e);
					}
				}
			}
			dragasource = null;
			d3.select(".draga").remove();
		}
		restart();
	});
const draglink = d3.drag()
	.filter( mods([1, 0, 0]) ) // shift & rien d'autre
	.on('start', (ev, e) => {
		e.dragend = (e.target == force.find(ev.sourceEvent.layerX, ev.sourceEvent.layerY)); // si on a cliqué plus près de la cible que de la source
		force.stop();
	})
	.on('drag', (ev, e) => {
		if (e.dragend) {
			e.dx2 = ev.x-e.target.x;
			e.dy2 = ev.y-e.target.y;
		} else {
			e.dx1 = ev.x-e.source.x;
			e.dy1 = ev.y-e.source.y;
		}
		e.u = true;
		tick();
	})
	.on('end', (ev, e) => {
		delete e.dragend;
		restart();
	});
const force = d3.forceSimulation()
	.on('tick', tick)
	.alphaDecay(1) // ad eternam
	.alphaTarget(0.3)
	.nodes(nodedata);
const redo = (x=0) => {
	scale += x;
	let s = (d) => (d.source?(d.dir?d.source:d.target):d).size || 8; // obtenir la taille applicable depuis un objet
	force
	.force('link', d3.forceLink(linkdata).distance(d => s(d)*8*scale).strength(forcepower)) // AG longueur théorique des flèches
	.force('collide', d3.forceCollide().radius( d => s(d)*3*scale).strength(forcepower))
	.force('center', d3.forceCenter(width/2, height/2).strength(center?0.1:0)); // moyenne des points au milieu
	nodes.attr("r", d => (asr?8:s(d))*scale).attr("opacity", d => d.hidden?0:1).call(dragnode); // rayon et opacité
	if (debug) nodes.attr("stroke", d => d.sx?"#F00":(d.parent?"#0F0":"#00F")).attr("stroke-width", d => s(d)*4*scale).attr("stroke-opacity", 0.15); // zone colorée
	else { nodes.attr("stroke-width", scale).attr('stroke', "black").attr("stroke-opacity", 1); /* ligne noire */ links.attr("stroke", "#000"); }
	labels.attr("font-size", 6*scale).attr("x", d => d.x+(s(d)+2)*scale).html(pmth);
	if (directed) links.style('marker-start', (d) => d.dir ? 'url(#start-arrow)' : "").style('marker-end', (d) => d.dir ? "" : 'url(#end-arrow)');
	links.attr('stroke-width', (d) => s(d)/4*scale).call(draglink);
	tick();
};
const removeparent = (n) => {
	if (!n.parent) return;
	n.x = n.parent.x + n.dx;
	n.y = n.parent.y + n.dy;
	delete n.parent;
	delete n.dx;
	delete n.dy;
}
const removestatic = (n) => {
	if (!n.sx) return;
	delete n.sx;
	delete n.sy;
}
const addnode = (newnode) => {
	force.stop(); // or you get a nasty load of NaNs
	nodedata.push(newnode); // update the array these same steps are reused for every update, won't detail them after
	force.nodes(nodedata); // feed it again to force.nodes()
	nodes._groups[0].push(
		getlast(nodes.data(nodedata)
			.enter()
			.append("circle") // create and style new element for newnode
			.attr("fill", randomcolor)
		._groups[0])
	); // and add it in nodes to make them update
	labels._groups[0].push( // rinse and repeat for labels
		getlast(labels.data(nodedata)
			.enter()
			.append("foreignObject")
			.html(pmth)
		._groups[0])
	);
	restart();
}
const removenode = (index) => {
	force.stop();
	let removed = nodedata.splice(nodedata.findIndex(x => x.index == index), 1)[0]; // enlever les données et les stocker
	nodedata.forEach(x => { if (x.index > removed.index) x.index-- }); // fill the blank in indexes
	force.nodes(nodedata);
	nodes._groups[0].splice(removed.index, 1)[0].remove(); // enlever les éléments de la liste et les détruire
	labels._groups[0].splice(removed.index, 1)[0].remove();
	let end = linkdata.length;
	for (let i=0;i<end;i++) { // supprimer tous les arrêtes utilisant ce noeud
		if (linkdata[i].source == removed || linkdata[i].target == removed) {
			removelink(i--);
			end--;
		}
	}
	nodedata.forEach(n => { // unchild every child
		if (!n.parent || n.parent != removed) return;
		removeparent(n);
	});
	restart();
}
const addlink = (newlink) => {
	force.stop();
	linkdata.push(newlink);
	force.force('link', d3.forceLink(linkdata));
	links._groups[0].push(
		getlast(links.data(linkdata)
			.enter()
			.append("line")
		._groups[0])
	);
	restart();
}
const removelink = (index) => {
	force.stop();
	linkdata.splice(index, 1);
	linkdata.forEach(x => { if (x.index > index) x.index-- });
	force.force('link', d3.forceLink(linkdata));
	links._groups[0].splice(index, 1)[0].remove();
	restart();
}
const seisdq = (s, c) => { // split except in simple double quotes
	let j = 0, osdq = true; // outside simple double quotes
	let l = [];
	for (let i=0;i<s.length;i++) {
		if (s[i] == c && osdq) { l.push(s.slice(j, i)); j = i+1; }
		else if (s[i] == '"') { if (s[i+1] == '"' && i<s.length-1) { i++ } else { osdq = !osdq } }
	}
	l.push(s.slice(j, s.length));
	return l
}
parse = (s) => { // parse a file's content for nodes & links
	force.stop();
	nodedata.length = 0; // empty data
	force.nodes(nodedata);
	linkdata.length = 0;
	force.force('link', d3.forceLink(linkdata));
	d3.selectAll("circle, line, foreignObject").remove(); // remove elements
	[nodes, links, labels].forEach(x => x._groups[0] = []); // empty element lists
	let l = seisdq(s, "\n").filter(x => x[0] != "#").map(s => seisdq(s, " ").map(s => seisdq(s, ",").map(s => s.trim().replaceAll('""', '"') )));
	scale = Number(l[0][1][0]); // take the first line for parameters
	force.stepDelay(Number(l[0][1][1]));
	forcepower = Number(l[0][1][2]);
	[running,wrap,debug,asr,center,directed] = l[0][1].slice(3).map(s => !s.slice(4));
	l.slice(1).forEach(l => {
		let obj = {};
		let addprops = () => { 
			for (let i=0;i<l[0].length;i++) { 
				if (l[0]) obj[l[0][i]] = /^\-?\d+$/.test(l[1][i])?Number(l[1][i]):l[1][i].slice(1, -1);
			} 
		};
		if (l[0][0].startsWith("[s]")) { // a link
			[obj.source, obj.target] = l[0].slice(0, 2).map(x => nodedata[Number(x.split("#")[1].slice(0, -1))]);
			l[0] = l[0].slice(2);
			addprops();
			obj.u = true; // force updat // force updatee
			obj.index = linkdata.length;
			addlink(obj);
		} else {
			if (l[0][0].startsWith("[p]")) { // child node
				obj.parent = l[0][0];
				l[0] = l[0].slice(1);
			}
			addprops();
			if (obj.parent) obj.parent = { x : obj.x-obj.dx, y : obj.y-obj.dy, index : Number(obj.parent.split("#")[1].slice(0, -1)) }; // coordonnées temporaires le temps d'ajouter tous les autres noeuds
			obj.ox = obj.oy = 0; // force affichage
			obj.index = nodedata.length;
			addnode(obj);
		}
	});
	nodedata.forEach(x => {if (x.parent) x.parent = nodedata[x.parent.index] }); // transformer les parents on noeuds
	restart();
}
const format = (o) => { // format the lists of keys & values
	let prop = Object.keys(o).filter(x => !["s", "t", "source", "target", "index", "x1", "x2", "y1", "y2", "parent", "ux", "uy", "ox", "oy", "u"].includes(x)); // remove properties that should not be written to file
	let vals = prop.map(p => typeof(o[p]) == "number"?Math.floor(o[p]):('"'+o[p].replaceAll('"', '""')+'"')); // round to make parsing numbers less of a bore & save space
	return prop.join(",")+" "+vals.join(",");
}
const stringify = () => (
	["scale,stepDelay,forcepower,running,wrap,debug,asr,center,directed"+" "+[scale, force.stepDelay(), forcepower, running, wrap, debug, asr, center, directed].join(",")].concat(
	nodedata.map( o => "# "+o.index+"\n"+(o.parent?("[p](#"+o.parent.index+"),"):"")+format(o) )
	.concat(linkdata.map( o => "[s](#"+o.source.index+"),[t](#"+o.target.index+"),"+format(o)
	))).join("\n")
);
svg.on("mousedown", (e) => { // clic
	if ( mods([0,1,1])(e) && e.target.nodeName == "circle") {
		let target = e.target.__data__; // static
		if (e.button != 2) {
			if (target.sx) {
				removestatic(target);
			} else {
				target.sx = target.x;
				target.sy = target.y;
				removeparent(target);
			}
			redo();
		} else { // visibility
			target.hidden = target.hidden?0:1;
			if (!target.hidden) delete target.hidden;
			redo();
		}
	} else if (mods([0,0,1])(e)) {
		if (e.target.nodeName == "circle") { // change node size
			e.target.__data__.size = (e.target.__data__.size || 8) + e.button - 1;
		} else if (e.target.nodeName == "line") {
			let l = e.target.__data__;
			if (!(l.dir = (!l.dir)?1:0)) delete l.dir;
		}
		redo();
	} else if (mods([0,0,0])(e) && e.button == 2) { // right click, node creation
		if (e.target == svge) { // not on a child element
			addnode({
				x : e.layerX,
				ox : 0,
				y : e.layerY,
				oy : 0,
				vx : 0,
				vy : 0,
				index : nodedata.length,
			})
		}
	} else if (mods([0,1,0])(e) && e.target != svge) { // deletion (nodes & links)
		let elem = e.target;
		if (elem.nodeName == "line") {
			removelink(elem.__data__.index);
		} else if (elem.nodeName == "circle") {
			removenode(elem.__data__.index);
		}
	} else if (mods([1, 0, 0])(e) && e.button != 2 && e.target.nodeName == "circle") { // rename
		let target = e.target.__data__;
		let indi = makepopup("inputdiv");
		indi.append("textarea").attr("id", "textinp");
		indi.append("input").attr("class", "cancel").attr("type", "button").attr("value", "Cancel").attr("onclick", "inputdiv.remove()");
		indi.append("input").attr("class", "valid").attr("type", "button").attr("value", "Save").attr("onclick", "idfinished(textinp.value); inputdiv.remove()");
		textinp.innerHTML = target.tx || "";
		idfinished = (s) => {
			target.tx = s;
			force.nodes(nodedata);
			labels.data(nodedata);
			labels._groups[0][target.index].innerHTML = s;
			restart();
		}
	}
});

body.on("keydown", (e) => {
	if (document.activeElement.nodeName != "BODY") return; // not typing in input/textarea/etc
	let key = e.key;
	if (key == "-" || key == "+") { p(e); scale += key=="-"?-1:1; redo(); } // rescale
	else if (key == "C" || key == "c") { // speed change
		p(e);
		force.stepDelay(Math.round(force.stepDelay()*1.2**(key=="c"?-1:1)));
		force.restart();
		redo();
	} else if (key == "F" || key == "f") { p(e); forcepower *= 1.1**(key=="f"?-1:1); redo(); }
	else if (key == "d") {
		if (!(directed = !directed)) {
			links.style("marker-start", "").style("marker-end", "");
		}
		redo();
	}
	else if (key == " ") { p(e); running?stop():start(); } // play/pause
	else if (key == "s") { // save
		p(e);
		let text = stringify();
		d3.select("#markdowncontainer").remove();
		let container = body.insert(getelemname(), ":first-child")
			.attr("id", "markdowncontainer")
			.html("<!--\n"+text+"\n-->");
		text = "<!DOCTYPE html>\n"+document.documentElement.outerHTML.replaceAll(/<(style|svg|div).*?\1>/gs, "");
		let file = new Blob([text]);
		if (fileurl) {
			window.URL.revokeObjectURL(fileurl)
		}
		fileurl = window.URL.createObjectURL(file);
		let a = body // download with a link added, clicked and removed. on slow machines, may appear in a flash
			.append("a")
			.attr("id", "dowa");
		dowa.href = fileurl;
		dowa.download = "wge-"+getseconds()+".html"; 
		dowa.click();
		dowa.remove();
	} else if (key == "o") { // upload
		p(e);
		let fidi = makepopup("filediv");
		fidi.append("input")
			.attr("type", "file")
			.attr("id", "fileinp");
		fidi.append("input").attr("type", "button").attr("value", "Load").attr("class", "valid")
			.attr("onclick", "fifinished(fileinp.files[0]); filediv.remove()");
		fidi.append("input").attr("type", "button").attr("value", "Cancel").attr("class", "cancel")
			.attr("onclick", "filediv.remove()");
		fifinished = (f) => {
			let reader = new FileReader();
			reader.onloadend = () => parse(reader.result);
			reader.readAsText(f);
		}
	} else if (key == "1") { p(e); if (debug = !debug) asr = false; redo(); }
	else if (key == "r") { p(e); resize(); }
	else if (key == "2") { p(e); wrap = !wrap; }
	else if (key == "h") { gethelp(); }
	else if (key == "3") { if (asr = !asr) debug = false; redo(); }
	else if (key == "e") { // edit md
		force.stop();
		helpbtn.style.display = "none"; // sticky doesn't like floats
		style.html(style.html()+"svg { float : left }\n");
		resize(width/2, height, false);
		let mddi = body.append("div").attr("id", "mddiv");
		mddi.append("textarea").attr("id", "mdinp").html(stringify);
		mddi.append("input").attr("type", "button").attr("class", "valid").attr("value", "Load")
			.attr("onclick", "parse(mdinp.value)");
		mddi.append("input").attr("type", "button").attr("class", "reload").attr("value", "Get from graph")
			.attr("onclick", "mdinp.value = stringify()");
		mddi.append("input").attr("type", "button").attr("class", "done").attr("value", "Close")
			.attr("onclick", "mdfinished()");
		mdfinished = () => {
			mddiv.remove();
			helpbtn.style.display = "";
			style.html(style.html().replace("svg { float : left }\n", ""));
			resize();
			restart();
		}
	}
	else if (key == "4") { center = !center; redo(); }
});
resize();
