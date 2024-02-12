/**
 * Slot.js
 * @requires jQuery 1.11
 * Created by Michael Poletaew <poletaew@gmail.com>
 * at 18:33, 02.10.2022 GMT+4
 */

const Slot = function (el, max, step) {
    this.speed = 0;
    this.step = step;
    this.isMoving = false;
    this.el = el;
    this.maxSpeed = max;
    this.minTop = 0;
    this.maxTop = 0;

    var self = this;

    this.onStop = function () {
        //on stop callback
        return;
    }

    this.start = function () {
        this.minTop = -.5 * $(this.el).parent().outerHeight();
        this.maxTop = -1 * $(this.el).outerHeight() + this.minTop;

        console.log('el', $(this.el), 'parent', $(this.el).parent());
        console.log('[WM] Slot', this);

        $(this.el).css('marginTop', this.minTop);
        this.isMoving = true;

        this.move();
    };

    this.correctMarginTop = function (marginTop) {
        if (marginTop > this.minTop) marginTop = this.maxTop;
        if (marginTop < this.maxTop) marginTop = this.minTop;

        return marginTop;
    }

    this.move = function () {
        if (this.speed < this.maxSpeed) {
            this.speed += this.step;
        }

        let $el = $(this.el),
            marginTop = this.correctMarginTop(this.speed + parseInt($el.css('margin-top')));

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

        let $el = $(this.el),
            marginTop = this.correctMarginTop(this.speed + parseInt($el.css('margin-top'))),
            remainder = marginTop % 6;
        if (remainder) marginTop -= remainder;

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