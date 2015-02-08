var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/games', function(error) {
	if (error) console.log(error);
});
var gamesSchema = mongoose.Schema({
	room_name: String,
	players: {
		white: String,
		black: String
	},
	fields: [{

		field: Number,
		color: String,
		isQueen: Boolean
	}],
	turn: String
});
var Games = mongoose.model('Games', gamesSchema);

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});
app.get('/play/:id', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});
app.get('/bootstrap', function(req, res) {
	res.sendFile(__dirname + '/bootstrap.min.css');
});

function gameHandler(from, to) {
	this.multipler;
	this.from = from;
	this.to = to;
	this.validateI = function() {
		if (this.from == to)
			return false;
		if (this.from <= 0 || this.from > 64 || this.to <= 0 || this.to > 64)
			return false;
		if (!((this.from - this.to) % 7 === 0 && (this.multipler = 7) || (this.from - this.to) % 9 === 0 && (this.multipler = 9)))
			return false;
		if ((this.from - this.to) / this.multipler !== Math.floor(this.from / 8) - Math.floor(this.to / 8))
			return false;
		return {
			'multipler': this.multipler,
			'moveBy': (this.to - this.from) / this.multipler
		};
	}
}

function move() {
	this.range = {
		remove: {},
		to: this.to,
		from: this.from,
		multipler: this.multipler,
		fromId : null
	};
	this.troughArray = function(element) {
		if (element.field >= this.from && element.field <= this.to && (this.from - element.field == this.multipler || this.from - element.field == -this.multipler || this.from - element.field == 0)) {
			if(element.field == this.from){
				this.isQueen = element.isQueen;
				this.fromId = element._id;
			}
			return element.field == this.from && element.color !== this.currentColor;
				// second player's turn
			return element.field == this.to;
				// there is already player on this place
			return element.color == this.currentColor && this.from !== element.field;
				// there is already player on this place
			return element.color != this.currentColor && this.remove.push(element._id) && this.remove.length > 1;
				// you cant hit more than one at once
		}

	}
	this.validateII = function(data) {
		this.range.currentColor = data.get('turn');
		if(!data.get('fields').some(this.troughArray, this.range) && !(this.range.remove.length != 1 && ((this.to - this.from) / this.multipler > 1 || (this.to - this.from) / this.multipler < -1)) ){
			return {remove: this.range.remove, from: this.range.fromId};
		}
		return false;
	// checks if player is not killing & trying to move by more than 2 rows
}
}


io.on('connection', function(socket) {
	socket.on('commitMove', function( from, to, callback) {
		var Game = new gameHandler(from, to);
		var validate = Game.validateI();
		if (validate) {
			move.prototype = Game;
			var Move = new move();
			Games
				.findOne({
					room_name: socket.roomName
				})
				.select()
				.exec()
				.then(function(data) {
					var actions =  Move.validateII(data);
					if(actions){
					data.fields.id(actions.from).field = to;
					console.log(data.room_name);
					io.sockets.in(data.room_name).emit('remove', from);
					io.sockets.in(data.room_name).emit('add', {
						field: to,
						isQueen: data.fields.id(actions.from).isQueen,
						color: data.fields.id(actions.from).color
					});
					}
					data.save();
				}, function(error) {
					console.log(error);
				});
		};
	});
	socket.on('joinRoom', function(roomName, playable, sendFields) {
		socket.roomName= roomName;
		var query = Games
			.findOne({
				room_name: socket.roomName
			})
			.select('players fields')
			.exec(function(err, data) {
				if (!data) {
					var newGame = new Games({
						room_name: roomName,
						players: {
							white: null,
							black: null
						},
						turn: 'white',
					});
					for (var i = 0; i < 64; i = i + 2) {
						if (i <= 22 || i >= 40) {
							newGame.fields.push({
								field: Math.floor(i / 8) % 2 == 1 ? i : i + 1,
								color: i > 31 ? 'black' : 'white',
								isQueen: false
							});
						}
					}
					newGame.save(function(error) {
						if (error)
							console.log(error);
					});
					playable(true, newGame.fields);
					return false;
				}
				data.players.white === null || data.players.black === null ? playable(true, data.fields) : playable(false, data.fields);
			});
		socket.join(roomName);
		socket.broadcast.to(roomName).emit('user joined', roomName);
	});
	socket.on('joinGame', function(ifSuccess) {
		var query = Games
			.findOne({
				room_name: socket.roomName
			})
			.select('players fields room_name')
			.exec(function(err, data) {
				if(!data){
					console.log('dupa');

				}
				else {

				if (data.players.white === null) {
					data.players.white = socket.id;
					ifSuccess('white');
				} else {
					if (data.players.black === null) {
						data.players.black = socket.id;
						data.turn = 'white';
						ifSuccess('black');
					}
					ifSuccess(false);
				}
				data.save();
				if (data.players.white !== null && data.players.black !== null) {
					socket.broadcast.to(data.room).emit('turn', 'white');
				}
				}
			});
	});
	socket.on('disconnect', function() {
		console.log('disconnect' + socket.id);
		var query = Games
			.findOne({
				$or: [{
					'players.white': socket.id
				}, {
					'players.black': socket.id
				}]
			})
			.select('players')
			.exec(function(err, data) {
				if (data) {
					(data.players.white == socket.id) ? data.players.white = null: data.players.white;
					(data.players.black == socket.id) ? data.players.black = null: data.players.black;
					if (data.players.black === null && data.players.white === null) {
						remove = data.room_name;
					}
					data.save();
				}
			});
			// socket.leave(socket.roomName);
		query = Games.remove({
			$and: [{
				'players.white': null
			}, {
				'players.black': null
			}]
		}, function(error) {
			if (error)
				console.log(error);
		})
	});
});

http.listen(3000, '127.0.0.1', function() {
	console.log('listening on *:3000');
});