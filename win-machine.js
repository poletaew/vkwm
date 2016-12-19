var WM = function (data) {
	this.VKdomain = 'https://vk.com/';
	this.apiVK = "https://api.vk.com/method/";

	this.link;
	this.additionalGroups;
	this.withRepost;
	this.countPrizes;

	this.postId;
	this.ownerId;
	this.itemId;
	this.totalParticipants;

	this.users = [];
	this.slices = [];
	this.otherGroups = [];
	this.countWinners = [];
	this.slots = [];
	this.slotHeight = 260;
	this.paylinePosition = 150;

	var self = this;

	this.construct = function (data) {
		this.link = data.link;

		this.additionalGroups = (data['additional-groups'] === 'on');
		this.withRepost = (data['with-repost'] === 'on');
		this.countPrizes = parseInt(data['count-prizes']);
		this.countWinners = $.isArray(data['count-winners']) ? data['count-winners'] : [data['count-winners']];
		if (data['other-group']) {
			this.otherGroups = $.isArray(data['other-group']) ? data['other-group'] : [data['other-group']];
		}

		var res = this.link.match(/wall((\-?\d+)_(\d+))/i);
		if (res === null) {
			alert('Неверная ссылка на конкурсный пост!');
			throw new Error('Bad link');
		}
		else {
			this.postId = res[1];
			this.ownerId = res[2];
			this.itemId = res[3];
		}
	};

	this.construct(data);

	this.run = function () {
		this.getUsers(0, this.getSlices);
	};


	//step 1
	this.getUsers = function (offset, callbackFunction) {
		this.setStatus('Считаем участников...');
		var count = 1000,
			filter = this.withRepost ? 'copies' : 'likes';

		if (!offset) offset = 0;

		var params = {
				type: "post",
				skip_own: true,
				filter: filter,
				owner_id: this.ownerId,
				item_id: this.itemId,
				count: count,
				offset: offset

			},
			getListCallback = function (data) {
				if (!self.users) self.users = data.response.users;
				else $.merge(self.users, data.response.users);
				var step = offset + count;

				if (!self.totalParticipants) self.totalParticipants = data.response.count;

				if (self.totalParticipants > step) {
					self.getUsers(step * (Math.PI / 2), callbackFunction);
				} else {
					callbackFunction(self);
				}
			}
			;

		if (window.useSDK) {
			VK.api("likes.getList", params, getListCallback);
		}
		else {
			$.get(this.apiVK + "likes.getList", params, getListCallback, "jsonp");
		}

		return this;
	};

	//step 2
	this.getSlices = function (self) {
		self.setStatus('Участников: <b>' + self.totalParticipants + '</b>. Делаем рандомные выборки из общего числа...');

		var key = 0,
			summOfWinners = 0,
			maxRatio = 50;

		//calc slice ratio
		$.each(self.countWinners, function () {
			summOfWinners += parseInt(this);
		});
		var ratio = Math.floor(self.users.length / summOfWinners);

		if (ratio > maxRatio) ratio = maxRatio;
		else if (ratio < 1) ratio = 1;

		for (var i = 0; i < self.countPrizes; i++) {
			for (var j = 0; j < self.countWinners[i] * ratio; j++) {
				key = parseInt(Math.random() * self.users.length - 1);
				if (!self.slices[i]) self.slices[i] = [];

				self.slices[i].push(self.users[key]);
				self.users.splice(key, 1);
			}
		}

		//next step
		self.getUsersInfo(self);
	};

	//step 3
	this.getUsersInfo = function (self) {
		var ids = [];

		$.each(self.slices, function () {
			$.merge(ids, this);
		});
		self.setStatus('Выбрали <b>' + ids.length + '</b> потенциальных победителей из <b>' + self.totalParticipants + '</b>. Получаем дополнительную информацию...');

		if (window.useSDK) {
			VK.api("users.get", {
				user_ids: ids.join(','),
				fields: "photo_200,screen_name"
			}, function (data) {
				self.updateSlices(data.response);
			});
		}
		else {
			$.post(this.apiVK + "users.get", {
					user_ids: ids.join(','),
					fields: "photo_200,screen_name"
				},
				function (data) {
					self.updateSlices(data.response);
				},
				"jsonp"
			);
		}
	};

	//step 4
	this.updateSlices = function (data) {
		this.setStatus('Загружаем барабаны...');
		var $img,
			$target = $('.win-machine');

		slicesIteration:
			for (var i in data) {
				for (var v in this.slices) {
					if (!this.slots[v]) {
						this.slots[v] = $('<div>', {
							id: 'slot-' + v,
							style: 'margin-left:' + (v * 156 + 20) + 'px'
						}).outerHeight(this.countWinners[v] * this.slotHeight)
							.addClass('slot').addClass('hidden');

						this.slots[v].append('<div>');
						$target.append(this.slots[v]);
					}

					for (var k in this.slices[v]) {
						if (this.slices[v][k] === data[i].uid) {
							if (data[i].photo_200) {
								$img = $('<img>', {
									id: data[i].uid,
									'data-uri': data[i].screen_name,
									'data-name': data[i].first_name + ' ' + data[i].last_name,
									src: data[i].photo_200
								});
								this.slots[v].find('div').append($img);
							}

							continue slicesIteration;
						}
					}
				}
			}

		this.drawSlotMachine();
	};

	//step 5
	this.drawSlotMachine = function () {
		this.setStatus('Начинаем вращение...');

		$('.slot').removeClass('hidden');

		var slots = [],
			i = 0,
			timeout = 0;

		$('.slot').each(function () {
			slots[i] = new Slot(
				$(this).find('div'),
				parseInt(Math.random() * 150 + 100),
				parseInt(Math.random() * 10 + 1)
			);

			var currentSlot = slots[i];
			currentSlot.i = i;

			currentSlot.start();

			timeout = (Math.random() * 5 + 5) * 1000;
			setTimeout(function () {
				self.setStatus('Слот #' + (currentSlot.i + 1) + ' вот-вот остановится...');
				currentSlot.stop(function (currentSlot) {
					self.checkWinners(currentSlot)
				});
			}, timeout);

			i++;
		});
	};

	this.checkWinners = function (currentSlot) {
		this.setStatus('Проверяем победителя #' + (currentSlot.i + 1));

		var wmTop = $('.win-machine').offset().top,
			hasWinner = false;

		$(currentSlot.el).find('img').each(function () {
			var minY = $(this).offset().top - wmTop,
				maxY = minY + $(this).outerHeight();

			if (minY < self.paylinePosition && self.paylinePosition < maxY) {

				if (self.otherGroups.length) {
					self.checkWinnerGroup($(this), (currentSlot.i + 1));
				}
				else {
					hasWinner = true;
					self.setWinner($(this), (currentSlot.i + 1));
				}

				return false;
			}
		});

		if (self.otherGroups.length === 0 && !hasWinner) {
			self.setStatus('<span class="red">Не получилось определить победителя #' + (currentSlot.i + 1) + ', спорная ситуация</span>');
		}
	}

	this.setWinner = function ($img, slotNumber) {
		var id = $img.attr('id'),
			data = $img.data(),
			$winner = $('<div>').addClass('winner');

		this.setStatus('<span class="green">Победитель # ' + slotNumber + ': @' + data.uri + ' (<b>' + data.name + '</b>)</span>');

		$img.after($winner);

		this.finalTimer = setTimeout(function () {
			self.showFinalInfo();
		}, 700);
	}

	this.showFinalInfo = function () {

		if (this.finalTimer) {
			clearTimeout(this.finalTimer);
		}

		var $winners = $('.win-machine').find('.winner').not('.waiting').not('.rejected'),
			totalWinners = 0;

		for (var i in this.countWinners) {
			totalWinners += parseInt(this.countWinners[i]);
		}

		if (totalWinners == $winners.length) {
			var $infoDiv = $('<div>');

			this.setStatus('<span class="green">Поздравляем победител' + (totalWinners == 1 ? 'я' : 'ей') + '!</span>');

			$('.old-statuses').prepend([$infoDiv, '<br>']);

			$winners.each(function (i) {
				var data = $(this).prev('img').data();

				$infoDiv.append(
					'<div>Победитель # ' + (i + 1) + ': @' + data.uri
					+ ' (<b><a target="_blank" href="' + self.VKdomain + data.uri + '">' + data.name + '</a></b>)</div>'
				)
			});
		}
		else {
			this.finalTimer = setTimeout(function () {
				self.showFinalInfo();
			}, 700);
		}
	}

	this.checkWinnerGroup = function ($img, slotNumber) {
		var id = $img.attr('id'),
			$winnerWaiting = $('<div>').addClass('winner waiting'),
			neededGroups = [],
			foundGroups = [];

		for (var i in this.otherGroups) {
			var tmp = this.otherGroups[i].match(/vk.com\/([^?]+)\??.*$/);
			neededGroups.push(tmp[1]);
		}

		$img.after($winnerWaiting);

		var params = {user_id: id, extended: true},
			groupsGetCallback = function (data) {
				if (data.response && data.response) {
					var groups = data.response || [];

					for (var i in groups) {
						if ($.inArray(groups[i].screen_name, neededGroups) !== -1) {
							foundGroups.push(groups[i].screen_name);
						}
					}
				}

				if (foundGroups.length != neededGroups.length) {
					self.setStatus('<span class="red">Победитель # ' + slotNumber + ' отклонён, причина: <b>не в группе</b></span>');
					$winnerWaiting.removeClass('waiting').addClass('rejected')
				}
				else {
					self.setStatus('Победитель # ' + slotNumber + ' состоит в указанной группе');
					$winnerWaiting.remove();
					self.setWinner($img, slotNumber);
				}

			}
			;

		if (window.useSDK) {
			VK.api("groups.get", params, groupsGetCallback);
		}
		else {
			$.get(this.apiVK + "groups.get", {user_id: id},
				groupsGetCallback,
				"jsonp"
			);
		}
	}

	this.setStatus = function (text) {
		$('.info:hidden').removeClass('hidden');

		if ($('.status-text').text()) {
			$('.old-statuses').prepend($('<div>', {html: '[WM] ' + $('.status-text').html()}));
		}


		$('.status-text').html(text);
		console.info('[WM] ' + $('.status-text').text());
	}


};

WM.setSlots = function (numberOfSlots) {
	var $machine = $('.win-machine');

	$machine.find('div').remove();

	$machine.append($('<div>', {class: 'slot-left'}));


	for (var i = 1; i <= numberOfSlots; i++) {
		if (i > 1) {
			$('.win-machine').append($('<div>', {class: 'slot-connector'}));
		}
		$machine.append($('<div>', {class: 'slot-mid'}));
	}

	$machine.append([
		$('<div>', {class: 'slot-right'}),
		$('<div>', {class: 'slot-hand'})
	]);

	var neWidth = 0;
	$machine.find('div').each(function () {
		neWidth += $(this).outerWidth();
	})

	$machine.width(neWidth);
}


var Slot = function (el, max, step) {
	this.speed = 0;
	this.step = step;
	this.isMoving = false;
	this.el = el;
	this.maxSpeed = max;
	this.minTop;

	var self = this;

	this.onStop = function () {
		//on stop callback
		return;
	}

	this.start = function () {
		this.minTop = -1 * $(this.el).outerHeight(true) + $(this.el).parent().height();

		$(this.el).css('marginTop', this.minTop);
		this.isMoving = true;

		this.move();


	};

	this.move = function () {
		if (this.speed < this.maxSpeed) {
			this.speed += this.step;
		}

		var $el = $(this.el),
			marginTop = this.speed + parseInt($el.css('margin-top'));

		if (marginTop >= 0) marginTop = this.minTop;

		$el.animate({marginTop: marginTop}, 90, function () {
			if (self.isMoving) {
				setTimeout(function () {
					self.move();
				}, 0);
			}
		});
	};

	this.slow = function () {
		if (this.speed > 0) {
			this.speed -= this.step;
		} else {
			this.onStop(this);
			return;
		}

		var $el = $(this.el),
			marginTop = this.speed + parseInt($el.css('margin-top')),
			remainder = marginTop % 6;
		if (remainder) marginTop -= remainder;
		if (marginTop >= 0) marginTop = this.minTop;
		$el.animate({marginTop: marginTop}, 90, function () {
			setTimeout(function () {
				self.slow();
			}, 0);
		});


	};

	this.stop = function (callback) {
		this.isMoving = false;
		if (callback) {
			this.onStop = callback;
		}

		this.slow();
	};
}
