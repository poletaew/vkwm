const WM = function (data) {
	this.VKdomain = 'https://vk.com/';
	this.apiVK = "https://api.vk.com/method/";

	this.link;
	this.additionalGroups;
	this.withRepost;
	this.countPrizes = 0;

	this.postId;
	this.ownerId;
	this.itemId;
	this.totalParticipants;

	this.users = [];
	this.slices = [];
	this.otherGroups = [];
	this.slots = [];
	this.slotHeight = 260;
	this.paylinePosition = 150;

	const self = this;

	this.construct = function (data) {
		console.log('construct', data);
		this.link = data.link;

		this.additionalGroups = (data['additional-groups'] === 'on');
		this.withRepost = (data['with-repost'] === 'on');
		this.countPrizes = parseInt(data['count-prizes']);
		if (data['other-group']) {
			this.otherGroups = $.isArray(data['other-group']) ? data['other-group'] : [data['other-group']];
		}

		let res = this.link.match(/wall((-?\d+)_(\d+))/i);
		if (res === null) {
			alert('Неверная ссылка на конкурсный пост!');
			throw new Error('Bad link');
		} else {
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
		const count = 1000,
			filter = this.withRepost ? 'copies' : 'likes';

		if (!offset) offset = 0;

		const params = {
				type: "post",
				skip_own: true,
				filter: filter,
				owner_id: this.ownerId,
				item_id: this.itemId,
				count: count,
				offset: offset

			},
			getListCallback = function (data) {
				if (!data.response.items || data.response.items.length === 0) {
					self.setStatus(
						'<span class="red"><b>Не удалось получить список пользователей по заданным условиям<b>.' +
						'<br>Возможно, вы не владелец группы, или ни один пользователь не выполнил указанные вами условия.</span>'
					);
					throw new Error('No users');
				}

				console.log('[WM] VK Response', data.response);

				if (!self.users) self.users = data.response.items;
				else $.merge(self.users, data.response.items);
				const step = offset + count;

				if (!self.totalParticipants) self.totalParticipants = data.response.items.length;

				if (self.totalParticipants > step) {
					self.getUsers(step * (Math.PI / 2), callbackFunction);
				} else {
					callbackFunction(self);
				}
			}
		;

		this.apiCall("likes.getList", params, getListCallback);

		return this;
	};

	//step 2
	this.getSlices = function (self) {
		self.setStatus('Участников: <b>' + self.totalParticipants + '</b>. Делаем рандомные выборки из общего числа...');

		const maxWinnerPerPrize = 50;

		console.log('[WM] Users: ', self.users);

		for (let i = 0; i < self.countPrizes; i++) {
			let NumberOfWinnersPerPrize = Math.ceil(self.users.length / (self.countPrizes - i));
			if (NumberOfWinnersPerPrize > maxWinnerPerPrize) NumberOfWinnersPerPrize = maxWinnerPerPrize;
			else if (NumberOfWinnersPerPrize < 1) NumberOfWinnersPerPrize = 1;

			for (let j = 0; j < NumberOfWinnersPerPrize; j++) {
				let key = Math.random() * self.users.length - 1;
				if (!self.slices[i]) self.slices[i] = [];

				self.slices[i].push(self.users[key]);
				self.users.splice(key, 1);
			}
			console.log(`[WM] Prize #${i} winners`, self.slices[i]);
		}

		//next step
		self.getUsersInfo(self);
	};

	//step 3
	this.getUsersInfo = function (self) {
		const ids = [];

		$.each(self.slices, function () {
			$.merge(ids, this);
		});
		self.setStatus('Выбрали <b>' + ids.length + '</b> потенциальных победителей из <b>' + self.totalParticipants + '</b>. Получаем дополнительную информацию...');

		self.apiCall("users.get", {
			user_ids: ids.join(','),
			fields: "photo_200,screen_name"
		}, function (data) {
			self.updateSlices(data.response);
		});
	};

	//step 4
	this.updateSlices = function (data) {
		this.setStatus('Загружаем барабаны...');
		let $img,
			$target = $('.win-machine');

		slicesIteration:
			for (const i in data) {
				for (const v in this.slices) {
					if (!this.slots[v]) {
						this.slots[v] = $('div#' + 'slot-' + v);

						if (!this.slots[v].length) {
							this.slots[v] = $('<div>', {
								id: 'slot-' + v,
								style: 'margin-left:' + (v * 156 + 20) + 'px'
							});
						}

						this.slots[v].outerHeight(this.slices[v].length * this.slotHeight).addClass('hidden');

						this.slots[v].append('<div>');
						$target.append(this.slots[v]);
					}

					for (const k in this.slices[v]) {
						if (this.slices[v][k] === data[i].id) {
							if (data[i].photo_200) {
								$img = $('<img>', {
									id: data[i].id,
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

		const $slot = $('.slot');

		$slot.removeClass('hidden');

		let slots = [],
			i = 0,
			timeout = 0;

		$slot.each(function () {
			slots[i] = new Slot(
				$(this).find('div'),
				Math.random() * 150 + 100,
				Math.random() * 10 + 1
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

	//step 6
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
				} else {
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
		let data = $img.data(),
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

		let $winners = $('.win-machine').find('.winner').not('.waiting').not('.rejected');


		if (this.countPrizes === $winners.length) {
			const $infoDiv = $('<div>');

			this.setStatus('<span class="green">Поздравляем победител' + (this.countPrizes === 1 ? 'я' : 'ей') + '!</span>');

			$('.old-statuses').prepend([$infoDiv, '<br>']);

			$winners.each(function (i) {
				const data = $(this).prev('img').data();

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
		const $winnerWaiting = $('<div>').addClass('winner waiting'),
			neededGroups = [];

		for (var i in this.otherGroups) {
			var tmp = this.otherGroups[i].match(/vk.com\/([^?]+)\??.*$/);
			neededGroups.push(tmp[1]);
		}

		$img.after($winnerWaiting);

		if (neededGroups.length > 1) {
			this.checkMultiGroupsMembership($winnerWaiting, $img, neededGroups);
		} else {
			this.checkMembership($winnerWaiting, $img, neededGroups[0], slotNumber);
		}
	}

	this.checkMembership = function ($object, $img, neededGroup, slotNumber) {
		var id = $img.attr('id'),
			userInfo = $img.data();

		this.apiCall("groups.isMember", {
				group_id: neededGroup,
				user_id: id
			},
			function (data) {
				if (data.response === 0) {
					self.setStatus('<span class="red">Победитель # ' + slotNumber
						+ ' (<a target="_blank" href="' + self.VKdomain + userInfo.uri + '">@' + userInfo.uri
						+ '</a>) отклонён, причина: <b>не в группе</b></span>');

					$object.removeClass('waiting').addClass('rejected');
				} else if (data.response === 1) {
					self.setStatus('Победитель # ' + slotNumber + ' состоит в указанной группе');
					$object.remove();
					self.setWinner($img, slotNumber);
				}
			}
		);
	}

	this.checkMultiGroupsMembership = function ($object, $img, neededGroups, slotNumber) {
		var foundGroups = [],
			id = $img.attr('id'),
			userInfo = $img.data();

		this.apiCall("groups.get", {
				user_id: id,
				extended: true
			},
			function (data) {

				if (data.response) {
					var groups = data.response;

					for (var i in groups) {
						if ($.inArray(groups[i].screen_name, neededGroups) !== -1) {
							foundGroups.push(groups[i].screen_name);
						}
					}

					if (foundGroups.length !== neededGroups.length) {
						self.setStatus('<span class="red">Победитель # ' + slotNumber
							+ ' (<a target="_blank" href="' + self.VKdomain + userInfo.uri + '">@' + userInfo.uri
							+ '</a>) отклонён, причина: <b>не в группе</b></span>');

						$object.removeClass('waiting').addClass('rejected');
					} else {
						self.setStatus('Победитель # ' + slotNumber + ' состоит в указанной группе');
						$object.remove();
						self.setWinner($img, slotNumber);
					}

				} else if (data.error) {
					self.setStatus('<span class="red">Победитель # ' + slotNumber
						+ ' (<a target="_blank" href="' + self.VKdomain + userInfo.uri + '">@' + userInfo.uri
						+ '</a>) отклонён, причина: <b>пользователь запретил просматривать свои группы</b></span>');

					$object.removeClass('waiting').addClass('rejected');
				}
			}
		);
	}

	this.apiCall = function (method, data, callback) {
		if (window.useSDK) {
			VK.api(method, data, callback);
		} else {
			$.get(this.apiVK + method, data, callback, "jsonp");
		}
	}

	this.setStatus = function (text) {
		$('.info:hidden').removeClass('hidden');

		const $statusText = $('.status-text');

		if ($statusText.text()) {
			$('.old-statuses').prepend($('<div>', {html: '[WM] ' + $statusText.html()}));
		}


		$statusText.html(text);
		console.info('[WM] ' + $statusText.text());
	}
};

WM.setSlots = function (numberOfSlots) {
	let $machine = $('.win-machine'),
		slots = [];

	$machine.find('div').remove();

	$machine.append($('<div>', {class: 'slot-left'}));


	for (let i = 1; i <= numberOfSlots; i++) {
		if (i > 1) {
			$machine.append($('<div>', {class: 'slot-connector'}));
		}
		$machine.append($('<div>', {class: 'slot-mid'}));
		slots.push($('<div>', {
			id: 'slot-' + (i - 1),
			style: 'margin-left:' + ((i - 1) * 156 + 20) + 'px',
			class: 'slot'
		}))
	}

	$machine.append([
		$('<div>', {class: 'slot-right'}),
		$('<div>', {class: 'slot-hand'})
	]);
	$machine.append(slots);


	var neWidth = 0;
	$machine.find('div').not('.slot').each(function () {
		neWidth += $(this).outerWidth();
	})

	$machine.width(neWidth);
}
