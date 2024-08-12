const totable = (x) => "<tr>"+x.map(y => "<td>"+y.join("</td><td>")+"</td>").join("</tr><tr>")+"</tr>"; // données en html
const info = `<table>
<tr><th>target</th><th>event</th><th>effect</th></tr>
`+totable([
["nodes", "ctrl left click", "delete"],
["nodes", "shift left click", "modify text"],
["nodes", "left drag", "move"],
["nodes", "right drag", "link to another node"],
["nodes", "ctrl right drag", "make child of another node/unchild if target is self"],
["nodes", "ctrl alt left click", "toggle visibility"],
["nodes", "ctrl alt right click", "toggle static position"],
["nodes", "alt left click", "reduce size"],
["nodes", "alt right click", "augment size"],
["links", "ctrl left click", "delete"],
["links", "shift drag", "move one end"],
["background", "right click", "create a node"],
["-", "pageup", "augment scale"],
["-", "pagedown", "reduce scale"],
["-", "up arrow", "load file"],
["-", "down arrow", "download file"],
["-", "left arrow", "slow down"],
["-", "right arrow", "speed up"],
["-", "space", "play/pause"],
["-", "enter", "toggle collision zones with colors"],
["-", "tab", "toggle bounds/wrapping"],
["-", "escape", "resize"],
["-", "h", "get this message"],
])+"</table>";
const body = d3.select('body');
const svg = body
	.append('svg')
	.on('contextmenu', () => { d3.event.preventDefault(); }) // pour utiliser clic droit
const svge = svg._groups[0][0]; // the actual svg element
var scale = 2;
var speed = 1;
var width, height;
var running = true; // simulation devrait avancer (modulo divers choses qui l'arrêtent)
var zones = false; // montrer les zones de collision
var wrap = true; // en fait plus rebondir
var fileurl = null;
var dragasource = null; // source de la flèche de draga
const empty = "element-that-does-not-exist"; // bonne chance d'être vrai
const p = () => d3.event.preventDefault(); // makes for a lot of repetition, but must only prevent if match, else all other (e.g. browse) events fail
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
		return d3.select("#"+empty) // moyen pratique de ne rien faire, on va append à rien
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
const resize = (x=window.innerWidth, y=window.innerHeight) => { // resizes the svg to fit the window
	svg.attr("width", width=x).attr("height", height=y);
	body.style("height", height+"px").style("width", width+"px");
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
svg.append('svg:defs').append('svg:marker') // définition des bouts de flèches
		.attr('id', 'end-arrow')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 8)
		.attr('orient', 'auto')
		.attr("markerWidth", 7)
		.attr("markerHeight", 7)
	.append('svg:path')
		.attr('d', 'M0,-5L10,0L0,5')
		.attr('fill', '#000');
svg.append('svg:defs').append('svg:marker')
		.attr('id', 'start-arrow')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 2)
		.attr('orient', 'auto')
		.attr("markerWidth", 7)
		.attr("markerHeight", 7)
	.append('svg:path')
		.attr('d', 'M10,-5L0,0L10,5')
		.attr('fill', '#000');
svg.append('svg:defs').append('svg:marker')
		.attr('id', 'drag-arrow')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 8)
		.attr('orient', 'auto')
		.attr("markerWidth", 7)
		.attr("markerHeight", 7)
	.append('svg:path')
		.attr('id', 'dragpath')
		.attr('d', 'M0,-5L10,0L0,5');
style = body.append("style")
	.html(`
html { background : lightgray; font-family : sans; }
body { margin : 0; background : white }
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
.valid, .cancel {
	width : 50%;
	height : calc(50% - 20px);
}
.done { background : #CCCCCC; width : 100% }
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
}
#textinp { 
	width : calc(100% - 24px);
	margin : 10px;
	height : calc(50% - 10px);
	border-radius : 10px;
}
textarea {
	border : none;
	font-family : monospace;
	resize : none;
	font-size : 20px;
	margin : 0;
	padding : 0;
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
`);
const randomcolor = () => { // (en hexa)
	return ("#" + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, "0"))
}
var links = svg.append("g")	.selectAll('line').data(linkdata).enter().append('line'); // ensemble des arretes
var nodes = svg.append("g") .selectAll('circle').data(nodedata).enter().append('circle');// ensemble des noeuds
var labels = svg.append("g").selectAll('foreignObject').data(nodedata).enter().append('foreignObject'); // ensemble des étiquettes
const tick = () => { // updates HTML coordinates (also some data manipulation)
	nodes
		.attr("cx", node => node.x = w(node.sx || (node.parent?(node.parent.x+node.dx):node.x)))
		.attr("cy", node => node.y = w(node.sy || (node.parent?(node.parent.y+node.dy):node.y), 1));
	labels
		.attr("x", node => node.x+((node.size || 8)+2)*scale)
		.attr("y", node => node.y);
	links
		.attr('x1', l => (l.source.x = w(l.source.x))+(l.dx1||0))
		.attr('y1', l => (l.source.y = w(l.source.y, 1))+(l.dy1||0))
		.attr('x2', l => (l.target.x = w(l.target.x))+(l.dx2||0))
		.attr('y2', l => (l.target.y = w(l.target.y, 1))+(l.dy2||0));
	if (dragasource) {
		d3.select(".draga")
			.attr("x1", w(dragasource.x))
			.attr("y1", w(dragasource.y));
	}
}
const dragnode = d3.drag() // forcé de faire une seule fonction de drag par élément
	.filter( () => !d3.event.shiftKey && !d3.event.altKey && (!d3.event.ctrlKey || d3.event.button == 2)) // on laisse possibilité de alt right, pour désigner un parent
	.on('start', e => {
		force.stop();
		if (d3.event.sourceEvent.button != 2) { // pas clic droit
			if (e.parent) {
				e.dx = d3.event.x - e.parent.x;
				e.dy = d3.event.y - e.parent.y;
			} else if (e.sx) {
				e.sx = d3.event.x;
				e.sy = d3.event.y;
			} else {
				e.x = d3.event.x;
				e.y = d3.event.y;
			}
			tick();
		} else {
			let color = d3.event.sourceEvent.ctrlKey?"gray":"black";
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
	.on('drag', e => {
		if (d3.event.sourceEvent.buttons != 2) {
			if (e.parent) {
				e.dx = d3.event.x - e.parent.x;
				e.dy = d3.event.y - e.parent.y;
			} else if (e.sx) {
				e.sx = d3.event.x;
				e.sy = d3.event.y;
			} else {
				e.x = d3.event.x;
				e.y = d3.event.y;
			}
			tick();
		} else {
			d3.select(".draga")
			.attr("x2", d3.event.x)
			.attr("y2", d3.event.y)
			.attr("x1", e.x)
			.attr("y1", e.y);
		}
	})
	.on('end', e => {
		if (dragasource) {
			let target = d3.event.sourceEvent.target;
			if (target.__data__ && target.nodeName == "circle") { // si on a fini le drag sur un cercle
				if (d3.select("#dragpath").attr("fill").slice(4)) { // black not gray, so linking
					let link = { 
						source : e,
						target : target.__data__,
						index : linkdata.length,
						dir : 1,
					};
					if (e != target.__data__ && !linkdata.some(x => x.source == e && x.target == target.__data__)) // arrête pas déjà existante
						addlink(link);
				} else {
					if (e != target.__data__) {
						e.parent = target.__data__;
						e.dx = e.x - e.parent.x;
						e.dy = e.y - e.parent.y;
						removestatic(e);
					} else {
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
	.filter( () => !d3.event.ctrlKey && !d3.event.altKey && d3.event.shiftKey ) // shift & rien d'autre
	.on('start', e => {
		e.dragend = (e.target == force.find(d3.event.sourceEvent.layerX, d3.event.sourceEvent.layerY)); // si on a cliqué plus près de la cible que de la source
		force.stop();
	})
	.on('drag', e => {
		if (e.dragend) {
			e.x2 = d3.event.x;
			e.y2 = d3.event.y;
		} else {
			e.x1=  d3.event.x;
			e.y1 = d3.event.y;
		}
		tick();
	})
	.on('end', e => {
		if (e.dragend) {
			e.dx2 = d3.event.x-e.target.x;
			e.dy2 = d3.event.y-e.target.y;
		} else {
			e.dx1 = d3.event.x-e.source.x;
			e.dy1 = d3.event.y-e.source.y;
		}
		delete e.dragend;
		restart();
	});
const force = d3.forceSimulation()
	.on('tick', tick)
	.alphaDecay(1)
	.alphaTarget(0.3)
	.nodes(nodedata);
const redo = (x=0) => {
	scale += x;
	force
	.force('link', d3.forceLink(linkdata).distance(d => ((d.dir?d.target:d.source).size || 6)*8*scale).strength(speed)) // AG longueur théorique des flèches
	.force('collide', d3.forceCollide().radius( d => (d.size || 8)*3*scale).strength(speed)) // AG autre type de répulsion
	.force('center', d3.forceCenter(width/2, height/2));
	nodes.attr("r", d => (d.size || 8)*scale).attr("opacity", d => d.hidden?0:1).call(dragnode); // rayon
	if (zones) nodes.attr("stroke", d => d.sx?"#F00":(d.parent?"#0F0":"#00F")).attr("stroke-width", d => ((d.size||8)*((3*scale)+2))+"px").attr("stroke-opacity", 0.15); // zone colorée
	else nodes.attr("stroke-width", scale).attr('stroke', "black").attr("stroke-opacity", "1"); // ligne noire
	labels.attr("font-size", 6*scale).attr("x", d => ((d.size || 8)+2)*scale).html(pmth);
	links.attr('stroke', 'black').style('marker-start', (d) => d.dir ? '' : 'url(#start-arrow)').style('marker-end', (d) => d.dir ? 'url(#end-arrow)' : '').attr('stroke-width', d => Math.max(((d.dir?d.target:d.source).size || 0)/4, 2)*scale).call(draglink);
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
	nodedata.forEach(n => {
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
const parse = (s) => { // parse a file's content for nodes & links
	force.stop(); 
	nodedata.length = 0; // empty data
	force.nodes(nodedata);
	linkdata.length = 0;
	force.force('link', d3.forceLink(linkdata));
	d3.selectAll("circle, line, foreignObject").remove(); // remove elements
	[nodes, links, labels].forEach(x => x._groups[0] = []); // empty element lists
	l = s.trim().split("\n").filter(x => x[0] != "#").map(s => s.split("\t").map(s => s.split(",").map(s => s.trim() )));
	scale = Number(l[0][1][0]); // take the first line for parameters
	running = !l[0][1][1].slice(4);
	speed = (Number(l[0][1][2]));
	l.slice(1).forEach(l => {
		let obj = {};
		let addprops = () => { 
			for (let i=0;i<l[0].length;i++) { 
				obj[l[0][i]] = /^\-?\d+$/.test(l[1][i])?Number(l[1][i]):decodeURIComponent(l[1][i]);
			} 
		};
		if (l[0][0].startsWith("[s]")) { // a link
			[obj.source, obj.target] = l[0].slice(0, 2).map(x => nodedata[Number(x.split("#")[1].slice(0, -1))]);
			l[0] = l[0].slice(2);
			addprops();
			obj.index = linkdata.length;
			addlink(obj);
		} else {
			if (l[0][0].startsWith("[p]")) {
				obj.parent = l[0][0];
				l[0] = l[0].slice(1);
			}
			addprops();
			if (obj.parent) obj.parent = { x : obj.x-obj.dx, y : obj.y-obj.dy, index : Number(obj.parent.split("#")[1].slice(0, -1)) };
			obj.index = nodedata.length;
			addnode(obj);
		}
	});
	nodedata.forEach(x => {if (x.parent) x.parent = nodedata[x.parent.index] }); // transformer les parents on objets
	restart();
}
const format = (o) => { // format the lists of keys & values
	let prop = Object.keys(o).filter(x => !["s", "t", "source", "target", "index", "x1", "x2", "y1", "y2", "parent"].includes(x)); // remove properties that should not be written to file
	let vals = prop.map(p => typeof(o[p]) == "number"?Math.floor(o[p]):encodeURIComponent(o[p])); // round to make parsing numbers less of a bore & save space
	return prop.join(",")+"\t"+vals.join(",");
}
const stringify = () => (
	["scale,running,speed"+"\t"+scale+","+running+","+speed].concat(
	nodedata.map( o => "# "+o.index+"\n"+(o.parent?("[p](#"+o.parent.index+"),"):"")+format(o) )
	.concat(linkdata.map( o => "[s](#"+o.source.index+"),[t](#"+o.target.index+"),"+format(o)
	))).join("\n")
);
svg.on("mousedown", () => { // clic
	if (d3.event.ctrlKey && d3.event.altKey && d3.event.target.nodeName == "circle") {
		let target = d3.event.target.__data__;
		if (d3.event.button != 2) {
			if (target.sx) {
				removestatic(target);
			} else {
				target.sx = target.x;
				target.sy = target.y;
				removeparent(target);
			}
			redo();
		} else {
			target.hidden = !target.hidden;
			if (!target.hidden) delete target.hidden;
			redo();
		}
	} else if (d3.event.altKey && d3.event.target.nodeName == "circle") {
			d3.event.target.__data__.size = (d3.event.target.__data__.size || 8) + d3.event.button - 1; // change size
			redo();
	} else if (d3.event.button == 2) { // right click, node creation
		if (d3.event.target == svge) { // not on a child element
			addnode({
				x : d3.event.layerX,
				y : d3.event.layerY,
				vx : 0,
				vy : 0,
				index : nodedata.length,
			})
		}
	} else if (d3.event.ctrlKey && d3.event.target != svge) { // deletion (nodes & links)
		let elem = d3.event.target;
		if (elem.nodeName == "line") {
			removelink(elem.__data__.index);
		} else if (elem.nodeName == "circle") {
			removenode(elem.__data__.index);
		}
	} else if (d3.event.shiftKey && d3.event.target.nodeName == "circle") { // rename
		let target = d3.event.target.__data__;
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
body.on("keydown", () => {
	if (document.activeElement.nodeName != "BODY") return; // not typing in input/textarea/etc
	let key = d3.event.key;
	if (key.startsWith("Page")) { // PageUp/PageDown
		p();
		redo(key.slice(6) ? -1 : 1);
	} else if (key == "ArrowLeft" || key == "ArrowRight") {
		p();
		speed = speed*1.2**(key.slice(9)?1:-1);
		redo();
	} else if (key == " ") {
		p();
		running?stop():start();
	} else if (key == "ArrowDown") {
		p();
		let file = new Blob([stringify()]);
		if (fileurl) {
			window.URL.revokeObjectURL(fileurl)
		}
		fileurl = window.URL.createObjectURL(file);
		let a = body // download with a link added, clicked and removed. on slow machines, may appear in a flash
			.append("a")
			.attr("id", "dowa");
		dowa.href = fileurl;
		dowa.download = "DGE-"+Math.floor(Date.now()/1000).toString()+".txt"; // default file name, the number is in seconds since epoch
		dowa.click();
		dowa.remove();
	} else if (key == "ArrowUp") {
		p();
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
	} else if (key == "Enter") {
		p();
		zones = !zones;
		redo();
	} else if (key == "Escape") {
		p();
		resize();
	} else if (key == "Tab") {
		p();
		wrap = !wrap;
	} else if (key == "h") {
		gethelp();
	}
});
resize();
